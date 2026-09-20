-- Nabi Books — Phase 4 seed data, generated from the current products array in App.tsx.
-- stock_quantity: "Only N left" became N; every "In stock" item got a PLACEHOLDER of 20.
-- Replace those with your real stock counts. Safe to run twice (skips existing slugs).

insert into public.categories (slug, name, sort_order) values ('book', 'Books', 1), ('stationery', 'Stationery', 2)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('field-notes', (select id from public.categories where slug = 'book'), 'A Summer of Stars', 'Liana Cincotti', null, 'A tender story for readers who like their shelves filled with wonder, warmth, and a little starlight.', 'Paperback · Liana Cincotti', 2400, 4.8, 20, '/assets/products/field-notes.png', array['Rose', 'Indigo']::text[], 'NABI pick', true, 1)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('small-hours', (select id from public.categories where slug = 'book'), 'the sun and her flowers', 'rupi kaur', null, 'A collection of poetry about growth, healing, love, and finding your way back to yourself.', 'Paperback · Poetry · rupi kaur', 1850, 4.6, 20, '/assets/products/small-hours.png', array['Lilac']::text[], null, true, 2)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('palimpsest', (select id from public.categories where slug = 'book'), 'The Chase', 'Elle Kennedy', null, 'A lively campus romance about hockey, friendship, and the kind of connection that changes everything.', 'Paperback · Romance · Elle Kennedy', 2900, 4.9, 3, '/assets/products/palimpsest.png', array['Moss', 'Plum']::text[], 'New arrival', true, 3)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('weather-between', (select id from public.categories where slug = 'book'), 'You', 'Caroline Kepnes', null, 'A sharp, unsettling novel about obsession, desire, and the stories people tell themselves.', 'Paperback · Psychological thriller · Caroline Kepnes', 2100, 4.7, 20, '/assets/products/weather-between.png', array['Blue']::text[], null, true, 4)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('moonlit-recipes', (select id from public.categories where slug = 'book'), 'Diary of a Wimpy Kid', 'Jeff Kinney', null, 'The hilarious illustrated diary of Greg Heffley as he navigates school, family, and everyday disasters.', 'Hardcover · Illustrated fiction · Jeff Kinney', 3200, 4.8, 20, '/assets/products/moonlit-recipes.png', array['Cream']::text[], null, false, 5)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('lilac-ledger', (select id from public.categories where slug = 'book'), 'If You Could See the Sun', 'Ann Liang', null, 'A bright young adult story about secrets, identity, and seeing the people around you more clearly.', 'Paperback · Young adult romance · Ann Liang', 1600, 4.9, 20, '/assets/products/lilac-ledger.png', array['Lilac', 'Rose']::text[], 'Bestseller', false, 6)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('night-study-set', (select id from public.categories where slug = 'stationery'), 'Night Study Set', null, 'Writing set', 'Three smooth graphite pencils, a brass sharpener, and a midnight-blue eraser.', 'Set of 5 · FSC-certified materials', 2200, 4.7, 20, '/assets/products/night-study-set.png', array['Indigo']::text[], null, false, 7)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('soft-markers', (select id from public.categories where slug = 'stationery'), 'Soft Focus Markers', null, 'Highlighter set', 'Six quietly luminous markers made for margins, reading lists, and gentle emphasis.', 'Set of 6 · Water-based ink · Chisel tip', 1400, 4.8, 5, '/assets/products/soft-markers.png', array['Pink', 'Mauve']::text[], null, false, 8)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('postcard-constellation', (select id from public.categories where slug = 'stationery'), 'Constellation Postcards', null, 'Postcard set', 'Eight little skies to send to someone who needs a sign from the universe.', 'Set of 8 · A6 · Printed on 350gsm stock', 1200, 4.6, 20, '/assets/products/postcard-constellation.png', array['Indigo', 'Gold']::text[], null, false, 9)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('linen-bookmark', (select id from public.categories where slug = 'stationery'), 'Linen Ribbon Bookmark', null, 'Reading accessory', 'A soft, stitched ribbon with a tiny brass moon for the page you are keeping.', 'Hand-finished · 28cm · Brass charm', 900, 4.9, 20, '/assets/products/linen-bookmark.png', array['Plum', 'Rose']::text[], null, false, 10)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('betting-on-you', (select id from public.categories where slug = 'book'), 'Betting on You', 'Lynn Painter', null, 'A bright, charming romance about friendship, timing, and taking a chance on someone unexpected.', 'Paperback · Contemporary romance · Lynn Painter', 2400, 4.8, 20, '/assets/products/betting-on-you.png', array['Teal', 'Pink']::text[], 'New arrival', false, 11)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('summer-broken-rules', (select id from public.categories where slug = 'book'), 'The Summer of Broken Rules', 'K. L. Walther', null, 'A sun-soaked summer story of family traditions, secret feelings, and rules made to be broken.', 'Paperback · Young adult romance · K. L. Walther', 2300, 4.7, 20, '/assets/products/summer-broken-rules.png', array['Coral', 'Navy']::text[], null, false, 12)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('color-swatch-set', (select id from public.categories where slug = 'stationery'), 'Color Swatch Set', null, 'Design reference set', 'A playful set of color references for journaling, planning, mood boards, and everyday creative work.', 'Assorted color cards · Reusable reference sheets', 1100, 4.7, 20, '/assets/products/color-swatch-set.png', array['Cobalt', 'Coral', 'Moss']::text[], 'For makers', false, 13)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('sing-me-to-sleep', (select id from public.categories where slug = 'book'), 'Sing Me to Sleep', 'Gabi Burton', null, 'A dark, lyrical fantasy about sirens, secrets, and the dangerous pull of a song.', 'Paperback · Fantasy · Gabi Burton', 2600, 4.8, 20, '/assets/products/sing-me-to-sleep.png', array['Midnight', 'Gold']::text[], null, false, 14)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('girl-beneath-sea', (select id from public.categories where slug = 'book'), 'The Girl Who Fell Beneath the Sea', 'Axie Oh', null, 'A lush myth-inspired tale of sacrifice, courage, and a world beneath the waves.', 'Paperback · Mythic fantasy · Axie Oh', 2500, 4.9, 3, '/assets/products/girl-beneath-sea.png', array['Teal', 'Azure']::text[], 'NABI pick', false, 15)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('the-do-over', (select id from public.categories where slug = 'book'), 'The Do-Over', 'Lynn Painter', null, 'A funny, tender second-chance romance about repeating one terrible day until it turns into something better.', 'Paperback · Young adult romance · Lynn Painter', 2200, 4.6, 20, '/assets/products/the-do-over.png', array['Fuchsia', 'Teal']::text[], null, false, 16)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('heaven', (select id from public.categories where slug = 'book'), 'Heaven', 'Mieko Kawakami', null, 'A spare and powerful novel about friendship, cruelty, and finding a way to endure.', 'Paperback · Literary fiction · Mieko Kawakami', 2800, 4.7, 20, '/assets/products/heaven.png', array['Ochre', 'Brown']::text[], null, false, 17)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('kim-jiyoung-born-1982', (select id from public.categories where slug = 'book'), 'Kim Jiyoung, Born 1982', 'Cho Nam-joo', null, 'A clear-eyed, quietly devastating portrait of one woman’s life and the systems that shape it.', 'Paperback · Translated fiction · Cho Nam-joo', 2100, 4.8, 20, '/assets/products/kim-jiyoung.png', array['Red', 'Blue']::text[], null, false, 18)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('song-of-achilles', (select id from public.categories where slug = 'book'), 'The Song of Achilles', 'Madeline Miller', null, 'A sweeping retelling of the love between Achilles and Patroclus, told with tenderness and mythic force.', 'Paperback · Historical mythology · Madeline Miller', 2900, 4.9, 20, '/assets/products/song-of-achilles.png', array['Teal', 'Gold']::text[], null, false, 19)
on conflict (slug) do nothing;

insert into public.products (slug, category_id, title, author, product_type, description, details, price, rating, stock_quantity, image_url, variants, badge, is_featured, sort_order)
values ('before-coffee-gets-cold', (select id from public.categories where slug = 'book'), 'Before the Coffee Gets Cold', 'Toshikazu Kawaguchi', null, 'A moving story about a Tokyo café, a time-traveling seat, and the conversations we wish we could have again.', 'Paperback · Magical realism · Toshikazu Kawaguchi', 2200, 4.8, 20, '/assets/products/coffee-novel-detail.png', array['Teal', 'Cream']::text[], null, false, 20)
on conflict (slug) do nothing;
