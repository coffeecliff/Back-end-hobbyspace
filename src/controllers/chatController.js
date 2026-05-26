const db  = require('../config/db');
const ml  = require('../ml/recommender');

const SYSTEM_PROMPT_BASE = `Você é o HobbyBot, assistente oficial do HobbySpace — plataforma brasileira de descoberta de hobbies.

Hobbies disponíveis: Música, Fotografia, Culinária, Leitura, Desenho, Jardinagem, Yoga, Xadrez.

Regras:
- Responda SEMPRE em português brasileiro, com tom amigável e encorajador.
- Ao sugerir hobbies, explique por que combinam com o perfil do usuário.
- Se o usuário já tem hobbies, ofereça dicas práticas e próximos passos.
- Respostas concisas — máx. 3 parágrafos curtos. Emojis com moderação.
- Fora do tema de hobbies, redirecione gentilmente.`;

async function chat(req, res) {
  try {
    const { message, history = [] } = req.body || {};
    if (!message?.trim()) return res.status(400).json({ message: 'Mensagem não pode ser vazia.' });

    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN || HF_TOKEN.includes('SEU_TOKEN')) {
      return res.status(503).json({
        message: 'Serviço de IA não configurado. Adicione HF_TOKEN no .env do servidor.',
      });
    }

    // Enriquece o prompt com contexto ML do usuário
    let userContext = '';
    try {
      const myHobbies = db.userHobbies
        .filter(uh => uh.userId === req.user.id)
        .map(uh => {
          const h = db.hobbies.find(h => h.id === uh.hobbyId);
          return h ? `${h.name} (nível: ${uh.level}, progresso: ${uh.progressPercent}%)` : null;
        }).filter(Boolean);

      const recs = ml.collaborativeRecommend(req.user.id, 3).map(h => h.name);

      if (myHobbies.length > 0) {
        userContext += `\nHobbies do usuário: ${myHobbies.join(', ')}.`;
      }
      if (recs.length > 0) {
        userContext += `\nHobbies recomendados pelo sistema para este usuário: ${recs.join(', ')}.`;
      }
    } catch (_) {}

    const systemPrompt = SYSTEM_PROMPT_BASE + (userContext ? `\n\nContexto do usuário:${userContext}` : '');

    const messages = [{ role: 'system', content: systemPrompt }];
    for (const msg of history.slice(-10)) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: String(msg.content) });
      }
    }
    messages.push({ role: 'user', content: message.trim() });

    const hfRes = await fetch('https://router.huggingface.co/novita/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-ai/DeepSeek-V3-0324',
        messages,
        max_tokens: 500,
        temperature: 0.75,
      }),
    });

    if (!hfRes.ok) {
      const errText = await hfRes.text().catch(() => '');
      console.error('[chat] HF status:', hfRes.status, errText.slice(0, 200));
      return res.status(502).json({ message: 'Erro ao conectar com o serviço de IA. Tente novamente.' });
    }

    const data = await hfRes.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ message: 'A IA não retornou resposta.' });

    return res.json({ reply });
  } catch (err) {
    console.error('[chat]', err);
    return res.status(500).json({ message: 'Erro interno do servidor.' });
  }
}

module.exports = { chat };
