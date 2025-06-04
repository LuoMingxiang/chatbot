'use client'

import { Bubble, Sender, XRequest } from '@ant-design/x'
import { useState, useRef, useEffect } from 'react'
import { Typography, Layout, theme, Flex } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import markdownit from 'markdown-it'
import type { BubbleProps } from '@ant-design/x'

const { Header, Content } = Layout
const { Title } = Typography

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const ChatPage: React.FC = () => {
  const { token } = theme.useToken()

  const md = markdownit({ html: true, breaks: true })
  md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet('style', 'margin-bottom: 0px;')
    return self.renderToken(tokens, idx, options)
  }

  const renderMarkdown: BubbleProps['messageRender'] = (content) => {
    return (
      <Typography>
        <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
      </Typography>
    )
  }

  const request = XRequest({
    baseURL: 'https://api.openai-next.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    dangerouslyApiKey: 'Bearer sk-gjXue7p1Wn76hTQe1b32089c903c48F6B62e86De01A5342b',
  })

  const userAvatarStyle: React.CSSProperties = {
    color: '#fff',
    backgroundColor: '#87d068',
  }

  const aiAvatarStyle: React.CSSProperties = {
    color: '#f56a00',
    backgroundColor: '#fde3cf',
  }

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好，我是你的AI助手，有什么可以帮助你的吗？' },
  ])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const messageEndRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentAnswer])

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Header
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
