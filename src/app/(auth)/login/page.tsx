"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

export default function Login() {
  const [email, setEmail] = useState('admin@anhhung.vn');
  const [password, setPassword] = useState('123456');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) router.push('/');
    else alert('Login failed');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Hệ Thống Quản Lý ERP</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full">Đăng Nhập</Button>
        </form>
      </Card>
    </div>
  );
}
