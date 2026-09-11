# 店員分離画像の生成プロンプト

生成手段: 組み込み image_gen ツール。サイズ: 1536×1024。

## 背景（shop-background.png）

Edit target supplied approved shop scene. Remove ONLY the shopkeeper entirely, reconstructing the shop shelves, plants, wall and wooden counter behind her. Preserve the whole background style, composition, warm light, right half, camera, perspective and counter at y90% exactly. Empty cozy Japanese shop background, strongly stylized warm 3D animated film render. No people, no limbs, no text or UI. 1536x1024 landscape.

## spriteIdlePrompt

Background-extraction edit. Extract ONLY the exact shopkeeper from supplied approved image onto TRUE TRANSPARENT alpha background. Keep canvas1536x1024, keep character at exact same pixel placement and scale on left side, preserve head tilt, face, gaze, closed-mouth mischievous smile, hair, cream blouse, green apron, arms and folded hands EXACTLY. Include all visible character from top hair to waist at y90%. Remove shop, counter, pots, all background; everything except character fully transparent, including full right half and bottom strip. Do NOT redraw pose, do NOT center or enlarge character. This is an aligned sprite for the same scene. Actual transparency, not white or checkerboard pixels.

## spriteSmilePrompt

Create an aligned transparent game character sprite by editing the supplied shopkeeper sprite. TRUE TRANSPARENT RGBA background,1536x1024 landscape. Keep the exact same stylized 3D woman identity, oversized head/small torso, freckles, rosy cheeks, dark messy bun, cream blouse, green apron. Keep character on LEFT HALF at same scale and waist baseline near90% canvas height, full right half empty transparent. Change full character pose to face directly forward toward player with warm delighted open-mouth smile, both large eyes looking directly at viewer; shoulders front facing and hands gently clasped at waist. Render complete visible character hair to waist, no shop/counter/props/text. Preserve soft warm lighting. No background, no glow outside silhouette.

## spriteSurpriseRetryPrompt

Edit the transparent PNG sprite supplied. Preserve its TRANSPARENT ALPHA BACKGROUND exactly. Change the woman's pose: lift BOTH hands with palms facing viewer beside cheeks; exaggerated surprise wide eyes, raised brows, open O mouth. Same woman, hair, ivory blouse, green apron, huge head small torso, warm3D style. Keep canvas1536x1024 and character on left half exactly as input. Output transparent background PNG as input. No checkerboard pattern. Only change character expression and arm pose.

## surpriseCutoutPrompt

Make a transparent-background cutout PNG of this surprised shopkeeper. Use background=transparent. Delete checkerboard and every background pixel, preserving the character. The delivered file must have a real alpha channel like a sticker asset. No checkerboard visualization in the generated content. Keep canvas and placement unchanged.

