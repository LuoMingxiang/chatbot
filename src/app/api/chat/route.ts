import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY' }), {
        status: 500
      });
    }

    const openaiRes = await fetch(
      'https://api.openai-next.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          stream: true,
          messages: body.messages
        })
      }
    );

    if (!openaiRes.ok || !openaiRes.body) {
      const error = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: 'OpenAI API error', detail: error }),
        { status: 500 }
      );
    }

    return new Response(openaiRes.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Transfer-Encoding': 'chunked'
      }
    });
  } catch (e) {
    console.error('API /chat 错误:', e);
    const err = e as Error;
    return new Response(
      JSON.stringify({ error: '服务器错误', detail: err.message }),
      { status: 500 }
    );
  }
}
