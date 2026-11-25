"""Stage this repository for Sites. The destination must already have a Sites project identity."""
import json
import shutil
import sys
from pathlib import Path
from PIL import Image

repo = Path(__file__).resolve().parents[1]
dest = Path(sys.argv[1]).resolve()
manifest = dest / ".openai/hosting.json"
settings = json.loads(manifest.read_text())
assert settings.get("project_id")
settings.update(d1="DB", r2=None)
manifest.write_text(json.dumps(settings, indent=2) + "\n")
public = dest / "public"
if public.is_symlink() or public == repo:
    raise ValueError("Use the dedicated Sites source checkout")
if public.exists():
    shutil.rmtree(public)
public.mkdir()
paths = [repo / name for name in ("index.html","attribution.js","site.css","robots.txt","sitemap.xml")]
for folder in ("img","journeys","photographs","patagonia"):
    paths.extend((repo / folder).rglob("*"))
allowed = {".html",".css",".js",".jpg",".svg",".pdf",".txt",".xml"}
for source in paths:
    if not source.is_file() or source.suffix not in allowed:
        continue
    target = public / source.relative_to(repo)
    target.parent.mkdir(parents=True,exist_ok=True)
    if source.suffix == ".jpg":
        with Image.open(source) as image:
            image.thumbnail((1440,1100))
            image.convert("RGB").save(target, quality=73, optimize=True)
    else:
        shutil.copy2(source,target)
for filename in ("worker.js","build.mjs","package.json","schema.ts","drizzle.config.ts","pnpm-lock.yaml"):
    shutil.copy2(repo / "_hosting" / filename,dest / filename)
shutil.copytree(repo / "_hosting/drizzle",dest / "drizzle",dirs_exist_ok=True)
(dest / ".gitignore").write_text("dist/\nnode_modules/\n")
