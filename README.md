# Simulador de Telhado com IA - Do Teto ao Jardim

Pasta pronta para publicar na Vercel. A página envia a foto para um pequeno servidor (api/simular.js),
que pede para a IA do Google limpar e pintar o telhado. A chave da IA fica só no servidor.

## Passo a passo (cerca de 10 minutos)

1. Crie a chave da IA
   - Acesse https://aistudio.google.com/apikey e crie uma chave (API key).
   - Ative o faturamento do projeto no Google, porque os modelos de imagem são pagos.
   - Defina um limite de gasto mensal no Google Cloud (Faturamento > Orçamentos e alertas).

2. Publique na Vercel (escolha UMA forma)
   - Forma A, pelo terminal: instale o Node.js, abra o terminal dentro desta pasta e rode `npx vercel --prod`.
     Responda as perguntas com Enter. Na primeira vez ele pede login.
   - Forma B, pelo GitHub: envie esta pasta para um repositório e, em vercel.com/new, importe o repositório.

3. Coloque a chave
   - Na Vercel: seu projeto > Settings > Environment Variables.
   - Nome: GEMINI_API_KEY | Valor: a chave do passo 1 | marque Production, Preview e Development.
   - Depois vá em Deployments e faça Redeploy do último deploy.

4. Deixe a página pública
   - Na Vercel: Settings > Deployment Protection > desative a proteção para Production.

5. Teste com uma foto de telhado. A primeira simulação leva de 10 a 40 segundos.

## Variáveis opcionais

- GEMINI_MODEL: modelo de imagem. Padrão gemini-3.1-flash-image. Se o Google trocar o nome, altere aqui.
- LIMIT_PER_HOUR: simulações por pessoa por hora. Padrão 12.
- LIMIT_PER_DAY: simulações no total por dia. Padrão 300. Controla o gasto máximo diário.
- ALLOWED_ORIGINS: se a página ficar no seu WordPress e chamar esta API de outro domínio,
  coloque o endereço do site (ex.: https://dotetoaojardim.com.br). Mais de um, separado por vírgula.

## Observações

- Cada clique em uma cor chama a IA de novo (a primeira vez). Cores já geradas ficam guardadas na página.
- Os limites por pessoa e por dia ficam na memória do servidor e podem reiniciar. O limite de gasto no Google é a proteção final.
- Para ver erros: Vercel > projeto > Logs. Procure por "Falha na IA".
- Para usar um endereço seu (ex.: simulador.dotetoaojardim.com.br): Vercel > Settings > Domains.
