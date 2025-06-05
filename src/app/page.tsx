'use client'

import { Bubble, Sender, XRequest } from '@ant-design/x'
import { useState, useRef, useEffect } from 'react'
import { Typography, Layout, theme, Flex, Spin, Avatar, Popover, Button } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import markdownit from 'markdown-it'
import type { BubbleProps } from '@ant-design/x'
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
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好，我是你的AI助手，有什么可以帮助你的吗？' },
  ])
  const userAvatarStyle: React.CSSProperties = {
    color: '#fff',
    backgroundColor: '#87d068',
  }
  const aiAvatarStyle: React.CSSProperties = {
    color: '#f56a00',
    backgroundColor: '#fde3cf',
  }
  const messageEndRef = useRef<HTMLDivElement>(null)
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
    if (!content.trim()) return
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)
    setCurrentAnswer('')
    let finalAnswer = '' // 临时变量收集完整流内容
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
            setMessages((prev) => [...prev, { role: 'assistant', content: finalAnswer }])
            setCurrentAnswer('')
          },
          onError: (error) => {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: `出错了：${error.message}` },
            ])
            setLoading(false)
          },
          onUpdate: (chunk) => {
            if (!chunk) return
            try {
              // 流式响应结束标志，直接忽略或处理结束逻辑
              if (chunk.data.trim() === '[DONE]') return
              const parsed = JSON.parse(chunk.data)
              const content = parsed?.choices?.[0]?.delta?.content
              if (content) {
                finalAnswer += content
                setCurrentAnswer((prev) => prev + content)
              }
            } catch (e) {
              console.error('流数据解析失败:', e)
            }
          },
        }
      )
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `异常错误：${(error as Error).message}` },
      ])
    } finally {
      setLoading(false)
      setInputValue('')
    }
  }
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
            onSubmit={handleSend}
            value={inputValue}
            placeholder="请输入你的问题..."
            disabled={loading}
            onChange={(e) => setInputValue(e)}
          />
        </div>
      </Content>
    </Layout>
  )
}

export default ChatPage
