const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const sharp = require("sharp");
const { Image } = require("node-webpmux");

const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const client = new Client({
  puppeteer: { headless: true, args: ["--no-sandbox"] },
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, "session_data") }),
});

client.on("qr", (qr) => {
  console.log("📲 Escaneie este QR Code para logar:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("🔐 Autenticado com sucesso!");
});

client.on("ready", () => {
  console.log("🤖 Bot de figurinhas está pronto!");
});

client.on("message", async (message) => {
  try {
    if (!message.hasMedia || message.type !== "image" || message.from.includes("@g.us")) return;

    const media = await message.downloadMedia();
    if (!media) return message.reply("❌ Não consegui baixar a imagem.");

    const buffer = Buffer.from(media.data, "base64");
    const ext = mime.extension(media.mimetype) || "jpg";
    const inputPath = path.join(tempDir, `img_${Date.now()}.${ext}`);
    const outputPath = path.join(tempDir, `sticker_${Date.now()}.webp`);

    fs.writeFileSync(inputPath, buffer);

    await sharp(inputPath)
      .resize(512, 512, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 90, lossless: false, nearLossless: true })
      .toFile(outputPath);

    //await embedMetadata(outputPath, "+55 86 99929-8797", "apolomecmec");

    const sticker = fs.readFileSync(outputPath);
    const stickerMedia = new MessageMedia("image/webp", sticker.toString("base64"), "sticker.webp");

    await message.reply(stickerMedia, null, { sendMediaAsSticker: true });
    console.log("✅ Figurinha enviada com sucesso!");

    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);
  } catch (err) {
    console.error("Erro ao processar imagem:", err);
    message.reply("❌ Algo deu errado ao criar a figurinha.");
  }
});


function createExifBuffer(json) {
  const jsonStr = JSON.stringify(json);
  const jsonBuffer = Buffer.from(jsonStr, "utf8");
  const exif = Buffer.alloc(jsonBuffer.length + 16);

  exif.write("Exif\0\0", 0);
  exif.writeUInt16LE(0x4949, 6);
  exif.writeUInt16LE(0x002a, 8);
  exif.writeUInt32LE(0x00000008, 10);
  exif.writeUInt16LE(0x0001, 14);
  exif.writeUInt16LE(0x4f, 16); 
  exif.writeUInt16LE(0x0001, 18);
  exif.writeUInt32LE(jsonBuffer.length, 20);
  exif.writeUInt32LE(0x0000001a, 24);
  jsonBuffer.copy(exif, 26);

  return exif;
}

process.on("SIGINT", () => {
  console.log("\n👋 Encerrando bot...");
  client.destroy().then(() => process.exit());
});

client.initialize();
