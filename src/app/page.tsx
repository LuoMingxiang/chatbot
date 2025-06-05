'use client'

import { Bubble, Sender, XRequest, Attachments } from '@ant-design/x'
import { useState, useRef, useEffect } from 'react'
import { Typography, Layout, theme, Flex, Spin, Avatar, Popover, Button, message } from 'antd'
import { UserOutlined, RobotOutlined, CloudUploadOutlined, LinkOutlined } from '@ant-design/icons'
import markdownit from 'markdown-it'
import type { BubbleProps, AttachmentsProps } from '@ant-design/x'
import type { GetProp, GetRef } from 'antd'
// import type { UploadFile, RcFile } from 'antd/es/upload/interface'
import { useClientAuthRedirect } from '@/hooks/useClientAuthRedirect';
import useUser from '@/hooks/useUser'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
const { Header, Content } = Layout
const { Title } = Typography

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const ChatPage: React.FC = () => {
  // 聊天相关状态
  const [currentAnswer, setCurrentAnswer] = useState('') // 当前正在流式接收的AI回答
  const [loading, setLoading] = useState(false) // 是否正在加载中
  const [inputValue, setInputValue] = useState('') // 输入框的值
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好，我是你的AI助手，有什么可以帮助你的吗？' },
  ])

  // 文件上传相关状态
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(false) // 附件面板是否打开
  const [attachmentFiles, setAttachmentFiles] = useState<GetProp<AttachmentsProps, 'items'>>([]) // 上传状态列表
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; url: string; size: number }>>([]) // 已上传文件列表

  // 样式相关
  const userAvatarStyle: React.CSSProperties = {
    color: '#fff',
    backgroundColor: '#87d068',
  }
  const aiAvatarStyle: React.CSSProperties = {
    color: '#f56a00',
    backgroundColor: '#fde3cf',
  }

  // 引用相关
  const messageEndRef = useRef<HTMLDivElement>(null) // 用于滚动到最新消息
  const attachmentsRef = useRef<GetRef<typeof Attachments>>(null) // 附件上传组件引用
  const senderRef = useRef<GetRef<typeof Sender>>(null) // 发送消息组件引用

  const { token } = theme.useToken()
  const { ready } = useClientAuthRedirect();
  const { user } = useUser()
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }
  // 用户信息内容
  const userContent = (
    <div>
      <p className="text-lg font-bold truncate">
        {user?.user_metadata?.full_name || user?.email}
      </p>
      <p className="text-xs text-gray-500 mt-1 truncate">
        {user?.email}
      </p>
      <div className="mt-2">
        <Button color="primary" variant="filled" className="w-full" onClick={handleLogout}>
          退出登陆
        </Button>
      </div>
    </div>
  )
  // mdown-it 配置
  const md = markdownit({ html: true, breaks: true })
  md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet('style', 'margin-bottom: 0px;')
    return self.renderToken(tokens, idx, options)
  }
  // 处理滚动到最新消息
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentAnswer])
  // 渲染 Markdown 内容
  const renderMarkdown: BubbleProps['messageRender'] = (content) => {
    return (
      <Typography>
        <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
      </Typography>
    )
  }
  // 创建请求实例
  const request = XRequest({
    baseURL: '/api/chat'
  })
  // 发送消息处理函数
  const handleSend = async (content: string) => {
    // 如果既没有文本内容也没有附件，则不发送
    if (!content.trim() && uploadedFiles.length === 0) return;

    // 准备消息内容
    let messageContent = content;
    if (uploadedFiles.length > 0) {
      const fileMessages = uploadedFiles.map(file =>
        `[文件] ${file.name} (${(file.size / 1024).toFixed(2)} KB)\n下载链接: ${file.url}`
      ).join('\n');
      messageContent = content ? `${content}\n\n${fileMessages}` : fileMessages;
    }

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: messageContent }];
    setMessages(newMessages);
    setLoading(true);
    setCurrentAnswer('');
    let finalAnswer = ''; // 临时变量收集完整流内容

    try {
      await request.create(
        {
          stream: true,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            ...newMessages,
          ],
        },
        {
          onSuccess: () => {
            setMessages((prev) => [...prev, { role: 'assistant', content: finalAnswer }]);
            setCurrentAnswer('');
            setUploadedFiles([]); // 发送成功后清空已上传文件列表
            setAttachmentFiles([]); // 清空上传状态列表
          },
          onError: (error) => {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: `出错了：${error.message}` },
            ]);
            setLoading(false);
          },
          onUpdate: (chunk) => {
            if (!chunk) return;
            try {
              if (chunk.data.trim() === '[DONE]') return;
              const parsed = JSON.parse(chunk.data);
              const content = parsed?.choices?.[0]?.delta?.content;
              if (content) {
                finalAnswer += content;
                setCurrentAnswer((prev) => prev + content);
              }
            } catch (e) {
              console.error('流数据解析失败:', e);
            }
          },
        }
      );
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `异常错误：${(error as Error).message}` },
      ]);
    } finally {
      setLoading(false);
      setInputValue('');
    }
  };
  // 检查文件大小不超过10MB，类型限制为图片、PDF、文本和 Word 文档
  const checkFileTypeAndSize = (file: File): boolean => {
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    return validTypes.includes(file.type) && file.size <= maxSize;
  };
  // 处理文件上传
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    try {
      // todo检查文件是否已存在

      // 显示上传中提示
      message.loading('文件上传中...');
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.details || result.error || '文件上传失败');
      }
      // 更新attachmentFiles
      setAttachmentFiles(prev => prev.map(f => {
        if (f.name === file.name) {
          return { ...f, status: 'done', url: result.publicUrl, size: file.size };
        }
        return f;
      }));
    } catch (error) {
      console.error('文件上传错误:', error);
      const errorMessage = error instanceof Error ? error.message : '文件上传失败';
      message.error(errorMessage);
    }
  };
  const beforeUpload: AttachmentsProps['beforeUpload'] = async (file) => {
    // 检查文件类型和大小
    checkFileTypeAndSize(file)
    // 上传文件
    handleFileUpload(file);
  }
  const handleFileChange: AttachmentsProps['onChange'] = async ({ fileList }) => {
    // 检查文件是否已存在
    console.log(attachmentFiles);
    // 更新上传状态列表
    setAttachmentFiles(fileList);
  }
  // 附件上传面板配置
  const attachmentPanel = (
    <Sender.Header
      title="附件"
      styles={{
        content: {
          padding: 0,
        },
      }}
      open={isAttachmentPanelOpen}
      onOpenChange={setIsAttachmentPanelOpen}
      forceRender
    >
      <Attachments
        ref={attachmentsRef}
        beforeUpload={beforeUpload}
        items={attachmentFiles}
        onChange={handleFileChange}
        placeholder={(type) =>
          type === 'drop'
            ? {
              title: '拖拽文件到这里',
            }
            : {
              icon: <CloudUploadOutlined />,
              title: '上传文件',
              description: '支持图片、PDF、文本文件和 Word 文档',
            }
        }
        getDropContainer={() => senderRef.current?.nativeElement}
      />
    </Sender.Header>
  )
  // 只控制返回内容，不跳过 Hooks 执行
  if (!ready) {
    return (
      <>
        <Spin tip="正在加载中..." size="large" fullscreen />
      </>
    )
  }
  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Header
        className='flex justify-between items-center'
        style={{
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          height: 64,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          AI 智能助手
        </Title>
        <Popover placement="rightTop" content={userContent}>
          <Avatar
            style={{ backgroundColor: '#fde3cf', color: '#f56a00' }}
            size={{ xs: 24, sm: 32, md: 36, lg: 38, xl: 42, xxl: 48 }}
          >U</Avatar>
        </Popover>

      </Header>

      <Content
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 64px)',
          backgroundColor: token.colorBgLayout,
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            borderRadius: token.borderRadiusLG,
            boxShadow: token.boxShadow,
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 24px',
              background: token.colorBgContainer,
              minHeight: 0,
            }}
          >
            <Flex gap="middle" vertical>
              {messages.map((message, index) => {
                const isAI = message.role === 'assistant'
                return (
                  <Bubble
                    key={index}
                    typing={{ step: 15, interval: 150 }}
                    content={message.content}
                    messageRender={renderMarkdown}
                    placement={isAI ? 'start' : 'end'}
                    loading={false}
                    variant="filled"
                    avatar={{
                      icon: isAI ? <RobotOutlined /> : <UserOutlined />,
                      style: isAI ? aiAvatarStyle : userAvatarStyle,
                    }}
                  />
                )
              })}
              {loading && currentAnswer && (
                <Bubble
                  key="streaming"
                  typing={{ step: 15, interval: 150 }}
                  content={currentAnswer}
                  messageRender={renderMarkdown}
                  placement="start"
                  loading={true}
                  variant="filled"
                  avatar={{
                    icon: <RobotOutlined />,
                    style: aiAvatarStyle,
                  }}
                />
              )}
              <div ref={messageEndRef} />
            </Flex>
          </div>
        </div>

        <div
          style={{
            background: token.colorBgContainer,
            borderRadius: token.borderRadiusLG,
          }}
        >
          <Sender
            ref={senderRef}
            header={attachmentPanel}
            prefix={
              <Button
                type="text"
                icon={<LinkOutlined />}
                onClick={() => {
                  setIsAttachmentPanelOpen(!isAttachmentPanelOpen);
                }}
              />
            }
            onSubmit={handleSend}
            value={inputValue}
            onChange={setInputValue}
            onPasteFile={() => { }}
            disabled={loading}
            placeholder="请输入你的问题..."
          />
        </div>
      </Content>
    </Layout>
  )
}

export default ChatPage
