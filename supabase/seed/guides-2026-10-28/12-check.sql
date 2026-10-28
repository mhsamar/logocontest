-- After the blocks: one row per guide you added (10, or 11 with the optional one), all draft, bn_ready true.
select slug, category, status, bn_ready, char_length(body_en) as en_chars, char_length(body_bn) as bn_chars
from public.guides
where slug in ('facebook-page-logo-size', 'ai-logo-maker-vs-designer', 'restaurant-logo-ideas', 'clothing-brand-logo-ideas', 'how-to-win-logo-contests', 'logo-trademark-bangladesh', 'logo-file-formats', 'what-makes-a-good-logo', 'logo-colours-meaning', 'bangla-logo-design', 'how-to-write-a-logo-brief')
order by slug;
