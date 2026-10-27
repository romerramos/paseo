# Paseo with Ruby highlighting

A build of Paseo Desktop that adds Ruby and ERB syntax highlighting to the file view, the editor and diffs. It follows every stable Paseo release and updates itself like the official app.

It needs a Mac with Apple silicon.

## Install

These steps are written for an agent. Run them from a terminal, not from an agent inside Paseo, and ask the user to quit Paseo first.

```sh
curl -fL https://github.com/romerramos/paseo/releases/latest/download/Paseo-mac-arm64.zip -o /tmp/Paseo-ruby.zip
[ -d /Applications/Paseo.app ] && mkdir -p ~/.paseo-official && mv /Applications/Paseo.app ~/.paseo-official/
ditto -x -k /tmp/Paseo-ruby.zip /Applications
open /Applications/Paseo.app
```

Download with `curl`, not a browser. macOS blocks unsigned apps downloaded by a browser.

Settings, paired devices and agents are kept as they are. The official app is kept in `~/.paseo-official/`.

## Updates

**Settings → Check for updates** works as usual. The app checks this fork's releases and installs updates when Paseo quits.

## Uninstall

Quit Paseo first, then run:

```sh
rm -rf /Applications/Paseo.app && mv ~/.paseo-official/Paseo.app /Applications/
```

If `~/.paseo-official/` is empty, download the official app from [paseo.sh](https://paseo.sh).
