#!/bin/bash
echo "Instalando dependências Python..."
pip install -r requirements.txt

echo "Rodando o Seed do Banco de Dados..."
python -m api.seed

# Se tiver build de frontend, adicione aqui, ex: npm run build
