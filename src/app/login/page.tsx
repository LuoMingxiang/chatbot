'use client'

import { useState } from 'react'
import { Form, Input, Button, message, Tabs } from 'antd'
import { LockOutlined, UserOutlined, GoogleOutlined } from '@ant-design/icons'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const AuthPage: React.FC = () => {
    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const handleSubmit = async (values: { email: string, password: string }) => {
        setLoading(true)
        const { email, password } = values
        if (mode === 'login') {
            message.loading({ content: '正在登录...', key: 'auth' })
            const { error } = await supabase.auth.signInWithPassword({ email, password })

            if (error) {
                // 自动注册逻辑
                if (error.message.includes('Invalid login credentials')) {
                    const { error: signUpError } = await supabase.auth.signUp({ email, password })
                    if (signUpError) {
                        setLoading(false)
                        return message.error({ content: `注册失败：${signUpError.message}`, key: 'auth' })
                    }
                    message.success({ content: '自动注册成功，请前往邮箱验证', key: 'auth' })
                    setLoading(false)
                    return
                }
                setLoading(false)
                return message.error({ content: `登录失败：${error.message}`, key: 'auth' })
            }

            message.success({ content: '登录成功', key: 'auth' })
            router.push('/')
        } else {
            message.loading({ content: '正在注册...', key: 'auth' })

            const { error } = await supabase.auth.signUp({ email, password })
            if (error) {
                setLoading(false)
                return message.error({ content: `注册失败：${error.message}`, key: 'auth' })
            }

            message.success({ content: '注册成功，请前往邮箱验证', key: 'auth' })
        }

        setLoading(false)
    }

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
        if (error) message.error(error.message)
    }

    return (
        <div
            className="flex justify-center items-center min-h-screen"
            style={{
                background: 'linear-gradient(to right, #f0f4ff, #e8f1ff)',
            }}
        >
            <div
                className="w-[400px] p-8 rounded-2xl shadow-xl"
                style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0eaff',
                    boxShadow: '0 0 24px rgba(22, 119, 255, 0.15)',
                }}
            >
                <Tabs
                    centered
                    activeKey={mode}
                    onChange={(key) => setMode(key as 'login' | 'register')}
                    items={[
                        { key: 'login', label: '登录' },
                        { key: 'register', label: '注册' },
                    ]}
                />

                <Form layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        name="email"
                        label="邮箱"
                        rules={[
                            { required: true, message: '请输入邮箱' },
                            { type: 'email', message: '邮箱格式不正确' },
                        ]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="请输入邮箱" allowClear />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="密码"
                        rules={[
                            { required: true, message: '请输入密码' },
                            ...(mode === 'register' ? [{ min: 6, message: '密码不能少于6位' }] : []),
                        ]}
                        hasFeedback={mode === 'register'}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
                    </Form.Item>

                    {mode === 'register' && (
                        <Form.Item
                            name="confirm"
                            label="确认密码"
                            dependencies={['password']}
                            hasFeedback
                            rules={[
                                { required: true, message: '请再次输入密码' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        if (!value || getFieldValue('password') === value) {
                                            return Promise.resolve()
                                        }
                                        return Promise.reject(new Error('两次输入的密码不一致'))
                                    },
                                }),
                            ]}
                        >
                            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
                        </Form.Item>
                    )}

                    <Form.Item>
                        <Button htmlType="submit" type="primary" block loading={loading}>
                            {mode === 'login' ? '登录' : '注册'}
                        </Button>
                    </Form.Item>

                    {mode === 'login' && (
                        <Form.Item>
                            <Button icon={<GoogleOutlined />} block onClick={handleGoogleLogin}>
                                使用 Google 登录
                            </Button>
                        </Form.Item>
                    )}
                </Form>
            </div>
        </div>
    )
}
export default AuthPage;