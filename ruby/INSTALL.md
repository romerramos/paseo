# Paseo with Ruby highlighting

A build of Paseo Desktop that adds Ruby and ERB syntax highlighting to the file view, the editor and diffs. The `ruby-highlighting` branch of [romerramos/paseo](https://github.com/romerramos/paseo) follows the latest stable Paseo release. This guide sets up a Mac to build that branch and keep it updated.

You need macOS, `git`, Node.js LTS and about 5 GB of disk space.

## Install

These steps are written for an agent. Run them from a terminal, not from an agent inside Paseo. Don't quit Paseo: the new app is swapped in the next time the user quits it.

```sh
git clone -b ruby-highlighting https://github.com/romerramos/paseo.git ~/.paseo-ruby/paseo
cp ~/.paseo-ruby/paseo/ruby/update.sh ~/.paseo-ruby/update.sh
sed -e "s|HOME_DIR|$HOME|g" -e "s|PATH_VALUE|$PATH|g" \
  ~/.paseo-ruby/paseo/ruby/paseo-ruby.plist > ~/Library/LaunchAgents/paseo-ruby.update.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/paseo-ruby.update.plist
```

The first build starts immediately and takes a few minutes. Follow it with `tail -f ~/.paseo-ruby/update.log`, and wait for `Paseo update ready` or `Paseo updated`.

Then ask the user to quit Paseo, and run `launchctl kickstart gui/$(id -u)/paseo-ruby.update` to install the new app right away. The official app is kept in `~/.paseo-ruby/official/`. Settings, paired devices and agents are kept as they are.

## Updates

Every hour, the job pulls the branch. When the branch has changed, it rebuilds the app and swaps it in the next time Paseo is closed. It never quits Paseo. A macOS notification appears when an update is installed or when a build fails.

This build has no built-in auto-update, so **Settings → Check for updates** does nothing.

## Uninstall

Quit Paseo first, then run:

```sh
launchctl bootout gui/$(id -u)/paseo-ruby.update
rm ~/Library/LaunchAgents/paseo-ruby.update.plist
rm -rf /Applications/Paseo.app
mv ~/.paseo-ruby/official/Paseo.app /Applications/
rm -rf ~/.paseo-ruby
```

If `~/.paseo-ruby/official/` is empty, download the official app from [paseo.sh](https://paseo.sh).
