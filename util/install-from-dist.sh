#!/bin/zsh
set -x;

CINNY_BINARY=~/.local/bin/cinny
CINNY_INSTALLATION=$CINNY_BINARY-bin
if [[ "$USER" == "root" ]]; then
  pacman -S --needed git curl tar base-devel || true;
  CINNY_BINARY=/usr/bin/cinny
  CINNY_INSTALLATION=/usr/share/cinny
fi;

set -e;

mkdir -p $CINNY_INSTALLATION;
cd $CINNY_INSTALLATION;
curl -fsSL -o /tmp/cinny.tar.gz https://github.com/Exponential-Workload/cinny-desktop/releases/latest/download/linux-bin-x64.tar.gz
tar -xzvf /tmp/cinny.tar.gz;
POSTINSTALL=true ./Cinny;
echo '#!/usr/bin/env bash' > $CINNY_BINARY;
echo "cd $CINNY_INSTALLATION" >> $CINNY_BINARY;
echo 'exec ./Cinny' >> $CINNY_BINARY;
chmod +x $CINNY_BINARY;
chmod +x --recusrive $CINNY_INSTALLATION;
if [[ "$USER" != "root" ]]; then
  exec $CINNY_BINARY;
fi;
