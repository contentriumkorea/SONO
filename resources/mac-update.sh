#!/bin/sh
set -u
[ "$#" -eq 8 ] || exit 2
old_pid=$1
target=$2
candidate=$3
workspace=$4
token=$5
version=$6
health=$7
health_ticks=$8
case "$old_pid:$health_ticks" in *[!0-9:]*|:*|*:) exit 2;; esac
case "$token" in ''|*[!0-9a-f-]*) exit 2;; esac
[ "${#token}" -eq 36 ] || exit 2
case "$target" in /*.app) ;; *) exit 2;; esac
case "$workspace" in /*/"$token") ;; *) exit 2;; esac
[ "$candidate" = "$target.sono-update-$token.app" ] || exit 2
[ "$health" = "$workspace/health" ] || exit 2
[ "$health_ticks" -ge 1 ] && [ "$health_ticks" -le 1200 ] || exit 2
[ -d "$target" ] && [ -d "$candidate" ] && [ -d "$workspace" ] || exit 2
backup="$target.sono-backup-$token"
[ ! -e "$backup" ] || exit 2
count=0
while kill -0 "$old_pid" 2>/dev/null; do
  count=$((count + 1))
  [ "$count" -lt 300 ] || { printf 'Old process did not stop\n' >&2; exit 1; }
  sleep 0.1
done
new_pid=''
rollback() {
  trap - EXIT HUP INT TERM
  if [ -n "$new_pid" ]; then
    kill "$new_pid" 2>/dev/null || :
    count=0
    while kill -0 "$new_pid" 2>/dev/null && [ "$count" -lt 50 ]; do count=$((count + 1)); sleep 0.1; done
    kill -KILL "$new_pid" 2>/dev/null || :
    wait "$new_pid" 2>/dev/null || :
  fi
  if [ -e "$target" ]; then /bin/mv "$target" "$workspace/failed.app" || exit 2; fi
  /bin/mv "$backup" "$target" || exit 2
  printf 'rollback\n' > "$workspace/status"
  "$target/Contents/MacOS/SONO" "--sono-update-rollback=$token" >> "$workspace/app.log" 2>&1 &
  printf 'SONO_UPDATE_ROLLBACK\n' >&2
  exit 1
}
/bin/mv "$target" "$backup" || exit 1
trap rollback EXIT HUP INT TERM
/bin/mv "$candidate" "$target" || exit 1
"$target/Contents/MacOS/SONO" "--sono-update-token=$token" >> "$workspace/app.log" 2>&1 &
new_pid=$!
printf '%s' "$new_pid" > "$workspace/app.pid"
count=0
while [ "$count" -lt "$health_ticks" ]; do
  if [ -f "$health" ] && [ "$(cat "$health")" = "$version" ]; then
    trap - EXIT HUP INT TERM
    /bin/rm -rf "$backup" || :
    printf 'installed\n' > "$workspace/status"
    printf 'SONO_UPDATE_INSTALLED\n'
    /bin/rm -rf "$workspace/unpacked" "$workspace/update.zip" "$workspace/install.sh" || :
    exit 0
  fi
  count=$((count + 1))
  sleep 0.1
done
exit 1
