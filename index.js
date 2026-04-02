const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// ============================================
// KONFIGURASI - ISI DENGAN DATA KAMU
// ============================================
const CONFIG = {
  WA_TOKEN: process.env.WA_TOKEN || 'GANTI_DENGAN_ACCESS_TOKEN_KAMU',
  WA_PHONE_NUMBER_ID: process.env.WA_PHONE_NUMBER_ID || 'GANTI_DENGAN_PHONE_NUMBER_ID',
  WEBHOOK_VERIFY_TOKEN: process.env.WEBHOOK_VERIFY_TOKEN || 'indahcargo_secret_token',
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'GANTI_DENGAN_DEEPSEEK_API_KEY',
};

// ============================================
// SISTEM PROMPT BOT CS INDAH CARGO
// ============================================
const SYSTEM_PROMPT = `Kamu adalah CS (Customer Service) virtual dari Indah Logistik Cargo.
Nama kamu adalah "Indi" - asisten virtual yang ramah, sopan, dan profesional.

Tugasmu:
- Menjawab pertanyaan seputar layanan pengiriman
- Memberikan informasi tarif, estimasi waktu pengiriman
- Membantu pelacakan paket
- Menerima keluhan dengan empati dan profesional
- Mengarahkan ke CS manusia jika masalah kompleks

Informasi perusahaan:
- Nama: Indah Logistik Cargo
- Layanan: Pengiriman paket, dokumen, cargo
- Area: Seluruh Indonesia
- Jam operasional: Senin-Sabtu 08.00-17.00 WIB
- Untuk masalah kompleks: hubungi CS di jam operasional

Panduan menjawab:
- Gunakan bahasa Indonesia yang sopan dan ramah
- Jawab singkat tapi jelas (max 3-4 kalimat)
- Sertakan emoji yang relevan agar lebih ramah
- Jika tidak tahu, jangan mengarang - arahkan ke CS manusia`;

// ============================================
// WEBHOOK VERIFICATION
// ============================================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified!');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.sendStatus(403);
  }
});

// ============================================
// TERIMA PESAN MASUK
// ============================================
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Balas cepat ke Meta

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const message = messages[0];
    const from = message.from; // Nomor pengirim
    const msgType = message.type;

    console.log(`📩 Pesan masuk dari ${from}: ${message.text?.body}`);

    // Hanya proses pesan teks
    if (msgType !== 'text') {
      await sendWhatsAppMessage(from, '🙏 Maaf, saat ini saya hanya bisa memproses pesan teks. Silakan ketik pertanyaan Anda.');
      return;
    }

    const userMessage = message.text.body;

    // Kirim "typing..." indicator
    await sendTypingIndicator(from);

    // Dapatkan jawaban dari DeepSeek AI
    const aiReply = await getDeepSeekReply(userMessage);

    // Kirim balasan ke WhatsApp
    await sendWhatsAppMessage(from, aiReply);

  } catch (error) {
    console.error('❌ Error processing message:', error.message);
  }
});

// ============================================
// FUNGSI: TANYA KE DEEPSEEK AI
// ============================================
async function getDeepSeekReply(userMessage) {
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 500,
        temperature: 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('❌ DeepSeek error:', error.message);
    return '🙏 Maaf, sistem kami sedang gangguan. Silakan hubungi CS kami langsung di jam operasional (Senin-Sabtu 08.00-17.00 WIB).';
  }
}

// ============================================
// FUNGSI: KIRIM PESAN WHATSAPP
// ============================================
async function sendWhatsAppMessage(to, message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${CONFIG.WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.WA_TOKEN}`,
          'Content-Type': 'application/json',
        }
      }
    );
    console.log(`✅ Pesan terkirim ke ${to}`);
  } catch (error) {
    console.error('❌ Gagal kirim pesan:', error.response?.data || error.message);
  }
}

// ============================================
// FUNGSI: TYPING INDICATOR
// ============================================
async function sendTypingIndicator(to) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${CONFIG.WA_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'reaction',
        reaction: { message_id: '', emoji: '⏳' }
      },
      {
        headers: {
          'Authorization': `Bearer ${CONFIG.WA_TOKEN}`,
          'Content-Type': 'application/json',
        }
      }
    );
  } catch (_) {
    // Typing indicator tidak wajib berhasil
  }
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/', (req, res) => {
  res.json({
    status: '✅ Bot CS Indah Cargo aktif',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot CS Indah Cargo berjalan di port ${PORT}`);
  console.log(`📌 Webhook URL: https://YOUR-APP.onrender.com/webhook`);
});
