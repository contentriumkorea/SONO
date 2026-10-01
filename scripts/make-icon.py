from PIL import Image, ImageDraw
from pathlib import Path
image = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((25, 25, 999, 999), radius=238, fill='#f3f3f3')
for x, height in [(242, 180), (367, 370), (492, 530), (617, 310), (742, 150)]:
    draw.rounded_rectangle((x, 512-height/2, x+40, 512+height/2), radius=20, fill='#202020')
out = Path('resources')
out.mkdir(exist_ok=True)
icon = image.resize((256, 256), Image.Resampling.LANCZOS)
icon.save(out/'icon.png')
icon.save(out/'icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
image.save(out/'icon.icns')
