import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

function sanitizeFileName(name: string) {
  return name
    .replace(/\.[^/.]+$/, '') // 去除扩展名
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function hashFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.from(arrayBuffer));
  return hash.digest('hex');
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: '没有找到文件' }, { status: 400 });
    }

    // 生成文件hash作为唯一标识
    const fileHash = await hashFile(file);
    const fileExt = file.name.split('.').pop() || 'bin';
    const sanitizedBaseName = sanitizeFileName(file.name);
    const finalFileName = `${sanitizedBaseName}_${fileHash.slice(
      0,
      8
    )}.${fileExt}`;
    const filePath = finalFileName;

    // 检查是否已存在
    const { data: existingFile } = await supabase.storage
      .from('chat-files')
      .list('', { search: finalFileName });

    const isUploaded = existingFile?.some(f => f.name === finalFileName);

    if (isUploaded) {
      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      return NextResponse.json(
        {
          message: '文件已存在，直接返回',
          repeat:true,
          filePath,
          publicUrl: urlData.publicUrl,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        },
        { status: 200 }
      );
    }

    // 上传新文件
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      console.error('文件上传错误:', uploadError);
      return NextResponse.json(
        { error: '文件上传失败', details: uploadError.message },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from('chat-files')
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: '获取文件URL失败', details: '未获取到 publicUrl' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: '文件上传成功',
        repeat:false,
        filePath,
        publicUrl: urlData.publicUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('上传处理错误:', error);
    return NextResponse.json(
      {
        error: '服务器处理错误',
        details: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
