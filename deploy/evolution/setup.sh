#!/usr/bin/env bash
# Instala Docker na VM (Ubuntu) e sobe a Evolution API. Rode: bash setup.sh
set -e
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
# Libera as portas 80/443 no firewall do Ubuntu (a Oracle bloqueia por padrão)
if command -v iptables >/dev/null; then
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
  sudo netfilter-persistent save 2>/dev/null || true
fi
# Memória extra (swap) para máquinas pequenas
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
[ -f .env ] || { cp .env.example .env; echo "Preencha o arquivo .env e rode o script de novo."; exit 0; }
sudo docker compose up -d
echo "Pronto! Teste em: https://$(grep ^DOMAIN= .env | cut -d= -f2)"
