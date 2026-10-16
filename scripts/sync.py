"""Keep existing SONO installations connected to public MusicBoard updates."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

SOURCE = 'contentriumkorea/MusicBoard'
TARGET = 'contentriumkorea/SONO'

def gh(*args, check=True):
    return subprocess.run(['gh', *args], check=check, capture_output=True, text=True)

def manifest(release):
    tag = release.get('tag_name', '')
    if not re.fullmatch(r'v\d+\.\d+\.\d+', tag) or release.get('draft') or release.get('prerelease'):
        raise ValueError('Expected a public stable release')
    version = tag[1:]
    if release.get('html_url') != f'https://github.com/{SOURCE}/releases/tag/{tag}':
        raise ValueError('Unexpected release location')
    result = {}
    for asset in release.get('assets', []):
        name = asset.get('name', '')
        expected = rf'(MusicBoard|SONO)-{re.escape(version)}-(mac-universal\.(dmg|zip)|windows-x64-setup\.exe)(\.blockmap)?'
        if name not in ('latest.yml', 'latest-mac.yml') and not re.fullmatch(expected, name):
            raise ValueError('Unexpected asset name')
        digest = asset.get('digest', '')
        if not re.fullmatch(r'sha256:[a-f0-9]{64}', digest) or not isinstance(asset.get('size'), int) or asset['size'] <= 0:
            raise ValueError('Missing asset integrity')
        if asset.get('browser_download_url') != f'https://github.com/{SOURCE}/releases/download/{tag}/{name}':
            raise ValueError('Unexpected asset location')
        if name in result:
            raise ValueError('Duplicate asset')
        result[name] = asset
    required = {'latest.yml', 'latest-mac.yml', f'SONO-{version}-mac-universal.dmg', f'SONO-{version}-mac-universal.zip', f'SONO-{version}-windows-x64-setup.exe', f'MusicBoard-{version}-windows-x64-setup.exe'}
    if not required <= result.keys():
        raise ValueError('Missing compatibility files')
    return tag, result

def main():
    if os.environ.get('GITHUB_REPOSITORY') != TARGET:
        raise ValueError('This workflow belongs only to the SONO compatibility repository')
    release = json.loads(gh('api', f'repos/{SOURCE}/releases/latest').stdout)
    tag, assets = manifest(release)
    current = gh('api', f'repos/{TARGET}/releases/tags/{tag}', check=False)
    if current.returncode == 0:
        target = json.loads(current.stdout)
        if not target.get('draft'):
            actual = {a['name']: a for a in target['assets']}
            if set(actual) != set(assets) or any(actual[n].get('digest') != a['digest'] or actual[n]['size'] != a['size'] for n, a in assets.items()):
                raise ValueError('Existing public mirror differs; refusing to overwrite it')
            print(f'Already current: {tag}')
            return
    elif 'HTTP 404' not in current.stderr:
        raise RuntimeError('Cannot inspect compatibility release')
    with tempfile.TemporaryDirectory(prefix='musicboard-update-') as work:
        folder = Path(work)
        gh('release', 'download', tag, '--repo', SOURCE, '--dir', work)
        if {p.name for p in folder.iterdir()} != set(assets):
            raise ValueError('Downloaded asset set differs')
        for name, asset in assets.items():
            file = folder / name
            with file.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            if file.stat().st_size != asset['size'] or digest != asset['digest'][7:]:
                raise ValueError('Downloaded update integrity mismatch')
        notes = folder / 'notes.md'
        notes.write_text(f'MusicBoard 공식 저장소: https://github.com/{SOURCE}\n\n이 저장소는 기존 SONO 앱의 업데이트 호환 전용입니다.\n\n' + release.get('body', ''), encoding='utf-8')
        files = [str(folder / name) for name in sorted(assets)]
        if current.returncode:
            gh('release', 'create', tag, '--repo', TARGET, '--draft', '--title', f'MusicBoard {tag[1:]}', '--notes-file', str(notes), *files)
        else:
            gh('release', 'upload', tag, '--repo', TARGET, '--clobber', *files)
        gh('release', 'edit', tag, '--repo', TARGET, '--draft=false', '--latest')
        copied = json.loads(gh('api', f'repos/{TARGET}/releases/tags/{tag}').stdout)
        actual = {a['name']: a for a in copied['assets']}
        if copied['draft'] or set(actual) != set(assets) or any(actual[n].get('digest') != a['digest'] for n, a in assets.items()):
            raise ValueError('Published mirror verification failed')
        print(f'Mirrored {tag}: {len(assets)} SHA-256 verified update assets')

if __name__ == '__main__':
    main()
