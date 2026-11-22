-- Pika je za neke gotove videe vratila naplatu 0 (22.11.2026, portal pokazivao "$0.00" za Pika H3 Flex). To nije stvarni
-- trošak: gotovi videi sa 0 dobijaju procjenu svog modela (VIDEO_MODELS.est u src/pika.js). Videi sa greškom ostaju 0.
UPDATE films SET cost_usd = CASE model
    WHEN 'pika/pika-h3-flex/image-to-video' THEN 0.2
    WHEN 'alibaba/wan3.0-video/image-to-video' THEN 0.325
    WHEN 'bytedance/seedance-2.0-mini/image-to-video' THEN 0.388
    WHEN 'minimax/hailuo-2.3-fast/image-to-video' THEN 0.192
    WHEN 'pika/pika-2.5/image-to-video' THEN 0.2
    ELSE 0.2 END
  WHERE status = 'ok' AND (cost_usd IS NULL OR cost_usd = 0);
