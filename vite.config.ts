import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {}, // Placeholder
      // [MOCK API] Fix 404 error for AlimTalk Templates in Local Dev
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // [CLEANUP] Catch ALL Aligo requests to silence 404s
          if (req.url?.includes('/api/aligo')) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              code: 0,
              success: true,
              list: [
                { code: 'TP_REMIND_01', name: '방문 리마인드 (기본)', content: '[웰니스더한남] 예약 알림\n\n#{이름}님, 내일(#{날짜}) #{시간} 예약을 안내드립니다.\n프로그램: #{프로그램}', status: 'R' },
                { code: 'TP_PAY_01', name: '결제 완료 안내', content: '[웰니스더한남] 결제 완료\n\n#{이름}님, #{상품명} 결제가 완료되었습니다.\n금액: #{결제금액}원', status: 'A' }
              ],
              message: 'Mock response'
            }));
            return;
          }
          next();
        });
      }
    },
    plugins: [
      react(),
      legacy({
        targets: ['ios >= 12', 'chrome >= 64', 'safari >= 11'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
      })
    ],
    build: {
      target: 'es2015',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
