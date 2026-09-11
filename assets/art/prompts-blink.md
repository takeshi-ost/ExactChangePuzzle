# 通常時のまばたき差分

生成: 組み込み image_gen ツール

入力: `cashier-idle-sprite.png` / 出力: `cashier-idle-blink.png`

表示はCSSの左右の目元マスクに限定し、元の通常画像を維持する。

Use case: precise-object-edit. Edit target: supplied idle shopkeeper sprite. Create a blink frame: ONLY close BOTH eyes gently and naturally, eyelids covering entire whites and irises, eyelashes resting along closed lids. Preserve EXACT head tilt, face outline, nose, mouth, brows, cheeks, hair, body, position, scale, lighting, colors and canvas1536x1024. Do not change smile or pose. Eye centers in original canvas roughly (340,290) and (540,355). No recentering. This will be composited only over the eye regions of the original for a brief blink. Keep all pixels outside eye areas as unchanged as possible. Preserve transparent background alpha. Output PNG.
