'use client'
import { Bubble, Sender, XRequest } from '@ant-design/x'
import { useState, useRef, useEffect } from 'react'
import { Typography, Layout, theme, Flex } from 'antd'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import markdownit from 'markdown-it';
import type { BubbleProps } from '@ant-design/x';
const { Header, Content } = Layout
const { Title } = Typography
interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}
const ChatPage: React.FC = () => {
  const { token } = theme.useToken()
  // markdown配置
  const md = markdownit({ html: true, breaks: true });
  md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
    tokens[idx].attrSet('style', 'margin-bottom: 0px;');
    return self.renderToken(tokens, idx, options);
  };
  const renderMarkdown: BubbleProps['messageRender'] = (content) => {
    return (
      <Typography>
        <div
          dangerouslySetInnerHTML={{ __html: md.render(content) }}
        />
      </Typography>
    );
  };
  // 定制化请求
  const request = XRequest({
    baseURL: 'https://api.openai-next.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    dangerouslyApiKey: 'Bearer sk-gjXue7p1Wn76hTQe1b32089c903c48F6B62e86De01A5342b',
  })
  // 用户头像
  const userAvatarStyle: React.CSSProperties = {
    color: '#fff',
    backgroundColor: '#87d068',
  }
  // AI头像
  const aiAvatarStyle: React.CSSProperties = {
    color: '#f56a00',
    backgroundColor: '#fde3cf',
  }
  // 消息列表
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好，我是你的AI助手，有什么可以帮助你的吗？' },
  ])
  // 思考中状态
  const [loading, setLoading] = useState(false)
  // 输入框
  const [inputValue, setInputValue] = useState('')
  // 消息节点控制
  const messageEndRef = useRef<HTMLDivElement>(null)
  // 发送消息
  const handleSend = async (content: string) => {
    const newMessages = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)

    try {
      await request.create(
        {
          stream: false,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            ...newMessages,
          ],
        },
        {
          onSuccess: (response) => {
            // 先判断是否为数组包裹
            const reply = response[0]?.choices?.[0]?.message?.content || 'AI暂无回复'
            setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
          },
          onError: (error) => {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: `出错了：${error.message}` },
            ])
          },
          onUpdate: (chunk) => { }
        }
      )

    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `异常错误：${(error as Error).message}` },
      ])
    } finally {
      setLoading(false)
      // 清除输入框
      setInputValue('');
    }
  }

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <>
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
          <Title level={4} style={{ margin: 0 }}>AI 智能助手</Title>
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
                      loading={loading && index === messages.length - 1}
                      variant="filled"
                      avatar={{
                        icon: isAI ? <RobotOutlined /> : <UserOutlined />,
                        style: isAI ? aiAvatarStyle : userAvatarStyle,
                      }}

                    />
                  )
                })}
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
              onChange={(e) => setInputValue(e.target)}
            />
          </div>
        </Content>
      </Layout>
    </>
  )
}
export default ChatPage