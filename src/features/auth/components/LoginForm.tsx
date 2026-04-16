'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Mail, Lock } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setError(error.message);
        } else {
          router.push('/auditoria');
          router.refresh();
        }
      } else {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setError(error.message);
        } else if (data.user && data.session === null) {
          setMessage('Revisa tu correo para verificar la cuenta.');
        } else {
          // If auto sign-in is enabled after sign up
          router.push('/auditoria');
          router.refresh();
        }
      }
    } catch (err: any) {
      setError('Ocurrió un error inesperado al procesar la solicitud.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-white/20 p-8 rounded-2xl shadow-xl w-full">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isLogin ? 'Iniciar Sesión' : 'Crea tu Cuenta'}
        </h2>
        <p className="text-gray-500 text-sm">
          {isLogin ? 'Ingresa tus credenciales para acceder' : 'Regístrate para comenzar a usar la plataforma'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-100 flex items-center">
          <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path></svg>
          {error}
        </div>
      )}

      {message && (
        <div className="bg-blue-50 text-blue-600 p-3 rounded-lg text-sm mb-6 border border-blue-100">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
            Correo Electrónico
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="email"
              type="email"
              required
              className="pl-10 block w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
            Contraseña
          </label>
          <div className="relative">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="password"
              type="password"
              required
              className="pl-10 block w-full border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors focus:ring-4 focus:ring-blue-200 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            isLogin ? 'Ingresar' : 'Registrarse'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError(null);
            setMessage(null);
          }}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors font-medium cursor-pointer bg-transparent border-0"
        >
          {isLogin
            ? '¿No tienes cuenta? Regístrate aquí'
            : '¿Ya tienes cuenta? Inicia sesión aquí'}
        </button>
      </div>
    </div>
  );
}
