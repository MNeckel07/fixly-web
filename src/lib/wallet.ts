import "server-only";
import { createSign, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * CARTÃO FIXLY NA CARTEIRA DO CELULAR
 * ===================================
 *
 * O mesmo cartão com QR que o profissional já compartilha, só que dentro da
 * Apple Wallet (iPhone) ou da Carteira do Google (Android): abre com um toque,
 * sobrevive à troca de celular e mostra o Selo Fixly quando ele tem.
 *
 * As duas plataformas EXIGEM credenciais próprias — não existe caminho sem
 * conta de desenvolvedor:
 *
 *   Google  GOOGLE_WALLET_ISSUER_ID   id de emissor (Google Pay & Wallet Console)
 *           GOOGLE_WALLET_SA_EMAIL    e-mail da service account
 *           GOOGLE_WALLET_SA_KEY      chave privada da service account (PEM)
 *
 *   Apple   APPLE_PASS_TYPE_ID        ex.: pass.company.fixly.cartao
 *           APPLE_TEAM_ID             Team ID da conta Apple Developer
 *           APPLE_PASS_P12            certificado do Pass Type ID (.p12 em base64)
 *           APPLE_PASS_P12_PASSWORD   senha do .p12
 *           APPLE_WWDR_PEM            certificado intermediário da Apple (PEM)
 *
 * Sem elas, `walletDisponivel()` devolve false e a tela simplesmente não
 * oferece o botão — melhor do que um botão que dá erro.
 */

export interface WalletCard {
  handle: string;
  name: string;
  category: string | null;
  headline: string | null;
  ratingLabel: string;
  jobsDone: number;
  /** Selo Fixly (reputação 4,5+) — é o que o dono quer ver na carteira. */
  elite: boolean;
  url: string;
}

export function googleWalletConfigurado() {
  return !!(
    process.env.GOOGLE_WALLET_ISSUER_ID &&
    process.env.GOOGLE_WALLET_SA_EMAIL &&
    process.env.GOOGLE_WALLET_SA_KEY
  );
}

export function appleWalletConfigurado() {
  return !!(
    process.env.APPLE_PASS_TYPE_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_PASS_P12 &&
    process.env.APPLE_WWDR_PEM
  );
}

export function walletDisponivel() {
  return { google: googleWalletConfigurado(), apple: appleWalletConfigurado() };
}

/* ───────────────────────── Google Wallet ───────────────────────── */

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Link "Salvar na Carteira do Google".
 *
 * A classe e o objeto vão INLINE no JWT: sem isso seria preciso criar cada
 * cartão pela API antes de mostrar o botão, o que dobraria a chance de falha
 * bem na hora em que o profissional quer compartilhar o cartão.
 */
export function googleWalletSaveUrl(card: WalletCard): string {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID!;
  const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL!;
  const saKey = process.env.GOOGLE_WALLET_SA_KEY!.replace(/\\n/g, "\n");
  const classId = `${issuerId}.fixly_cartao`;
  const objectId = `${issuerId}.${card.handle.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixly.company";

  const genericClass = {
    id: classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['servico']" }] } },
              endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['avaliacao']" }] } },
            },
          },
        ],
      },
    },
  };

  const genericObject = {
    id: objectId,
    classId,
    genericType: "GENERIC_TYPE_UNSPECIFIED",
    hexBackgroundColor: "#FFC107",
    logo: {
      sourceUri: { uri: `${appUrl}/fixly-symbol.png` },
      contentDescription: { defaultValue: { language: "pt-BR", value: "Fixly" } },
    },
    cardTitle: { defaultValue: { language: "pt-BR", value: "Fixly" } },
    subheader: { defaultValue: { language: "pt-BR", value: card.category ?? "Profissional" } },
    header: { defaultValue: { language: "pt-BR", value: card.name } },
    textModulesData: [
      { id: "servico", header: "Serviço", body: card.category ?? "Profissional" },
      { id: "avaliacao", header: "Avaliação", body: card.ratingLabel },
      ...(card.elite ? [{ id: "selo", header: "Selo Fixly", body: "Profissional com selo de qualidade" }] : []),
    ],
    barcode: {
      type: "QR_CODE",
      value: card.url,
      alternateText: `@${card.handle}`,
    },
    linksModuleData: {
      uris: [{ uri: card.url, description: "Ver perfil no Fixly", id: "perfil" }],
    },
  };

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: saEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [appUrl.replace(/^https?:\/\//, "")],
    payload: { genericClasses: [genericClass], genericObjects: [genericObject] },
  };

  const assinar = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const assinatura = createSign("RSA-SHA256").update(assinar).sign(saKey);
  return `https://pay.google.com/gp/v/save/${assinar}.${b64url(assinatura)}`;
}

/* ───────────────────────── Apple Wallet ───────────────────────── */

/** CRC-32 (ZIP). Tabela montada uma vez. */
const CRC_TABELA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABELA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * ZIP sem compressão (método "store").
 *
 * O .pkpass é um zip comum; escrever os ~60 bytes de cabeçalho à mão evita
 * arrastar uma biblioteca de compressão para o servidor por causa de 4 arquivos
 * pequenos. "Store" é aceito pelo Wallet e mantém o SHA-1 do manifesto válido.
 */
function zip(arquivos: { nome: string; dados: Buffer }[]): Buffer {
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const { nome, dados } of arquivos) {
    const nomeBuf = Buffer.from(nome, "utf8");
    const crc = crc32(dados);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);   // assinatura
    local.writeUInt16LE(20, 4);           // versão necessária
    local.writeUInt16LE(0, 6);            // flags
    local.writeUInt16LE(0, 8);            // método: store
    local.writeUInt16LE(0, 10);           // hora
    local.writeUInt16LE(0, 12);           // data
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(dados.length, 22);
    local.writeUInt16LE(nomeBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locais.push(local, nomeBuf, dados);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);             // versão de criação
    dir.writeUInt16LE(20, 6);             // versão necessária
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(0, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(dados.length, 20);
    dir.writeUInt32LE(dados.length, 24);
    dir.writeUInt16LE(nomeBuf.length, 28);
    dir.writeUInt16LE(0, 30);             // extra
    dir.writeUInt16LE(0, 32);             // comentário
    dir.writeUInt16LE(0, 34);             // disco
    dir.writeUInt16LE(0, 36);             // atributos internos
    dir.writeUInt32LE(0, 38);             // atributos externos
    dir.writeUInt32LE(offset, 42);        // posição do cabeçalho local
    central.push(dir, nomeBuf);

    offset += 30 + nomeBuf.length + dados.length;
  }

  const centralBuf = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(0, 4);
  fim.writeUInt16LE(0, 6);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(centralBuf.length, 12);
  fim.writeUInt32LE(offset, 16);
  fim.writeUInt16LE(0, 20);

  return Buffer.concat([...locais, centralBuf, fim]);
}

/** Assinatura PKCS#7 destacada do manifesto (é o que a Apple confere). */
async function assinarManifesto(manifesto: Buffer): Promise<Buffer> {
  const forge = (await import("node-forge")).default;
  const p12Der = forge.util.decode64(process.env.APPLE_PASS_P12!);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, process.env.APPLE_PASS_P12_PASSWORD ?? "");

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
  const cert = certBags[0]?.cert;
  const key = keyBags[0]?.key;
  if (!cert || !key) throw new Error("Certificado do Pass Type ID inválido (não achei certificado/chave no .p12).");

  const wwdrPem = process.env.APPLE_WWDR_PEM!.includes("BEGIN CERTIFICATE")
    ? process.env.APPLE_WWDR_PEM!
    : Buffer.from(process.env.APPLE_WWDR_PEM!, "base64").toString("utf8");
  const wwdr = forge.pki.certificateFromPem(wwdrPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifesto.toString("binary"));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key: key!,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toISOString() },
    ],
  });
  // destacada: o manifesto não vai dentro da assinatura (ele já está no zip)
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

/** Monta o .pkpass pronto para o iPhone abrir. */
export async function applePkpass(card: WalletCard): Promise<Buffer> {
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    serialNumber: card.handle,
    organizationName: "Fixly",
    description: `Cartão Fixly de ${card.name}`,
    logoText: "Fixly",
    foregroundColor: "rgb(31,35,41)",
    backgroundColor: "rgb(255,193,7)",
    labelColor: "rgb(31,35,41)",
    barcodes: [
      { message: card.url, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: `@${card.handle}` },
    ],
    generic: {
      primaryFields: [{ key: "nome", label: "Profissional", value: card.name }],
      secondaryFields: [
        { key: "servico", label: "Serviço", value: card.category ?? "Profissional" },
        { key: "avaliacao", label: "Avaliação", value: card.ratingLabel },
      ],
      auxiliaryFields: [
        { key: "servicos", label: "Serviços concluídos", value: String(card.jobsDone) },
        ...(card.elite ? [{ key: "selo", label: "Selo Fixly", value: "Profissional com selo" }] : []),
      ],
      backFields: [
        { key: "perfil", label: "Perfil público", value: card.url },
        ...(card.headline ? [{ key: "chamada", label: "Sobre", value: card.headline }] : []),
        {
          key: "aviso",
          label: "Importante",
          value:
            "O Fixly é uma plataforma que aproxima contratantes e profissionais. A execução do serviço e as garantias são responsabilidade do profissional.",
        },
      ],
    },
  };

  const raiz = process.cwd();
  const simbolo = await readFile(path.join(raiz, "public", "fixly-symbol.png"));

  const arquivos: { nome: string; dados: Buffer }[] = [
    { nome: "pass.json", dados: Buffer.from(JSON.stringify(passJson), "utf8") },
    { nome: "icon.png", dados: simbolo },
    { nome: "icon@2x.png", dados: simbolo },
    { nome: "logo.png", dados: simbolo },
  ];

  const manifesto = Buffer.from(
    JSON.stringify(
      Object.fromEntries(
        arquivos.map((a) => [a.nome, createHash("sha1").update(a.dados).digest("hex")]),
      ),
    ),
    "utf8",
  );
  const assinatura = await assinarManifesto(manifesto);

  return zip([...arquivos, { nome: "manifest.json", dados: manifesto }, { nome: "signature", dados: assinatura }]);
}
