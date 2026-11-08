-- Refresh current menu images only; preserve historical order snapshots.
BEGIN;
DO $$ BEGIN
  IF (SELECT count(*) FROM dishes WHERE id IN ('banh-hoi','banh-xeo','banh-duc','bun-bo-hue','bun-ca','bun-mam','bun-rieu-cua-dong','bun-thang','chao-suon','com-ga-xoi-mo','com-tron','mien-ga','nem-nuong-nha-trang','pho-tron','pho-tron-chua-ngot')) <> 15 THEN
    RAISE EXCEPTION 'Expected all15 menu dishes; no image changes applied';
  END IF;
END $$;
UPDATE dishes SET image_url='https://bizweb.dktcdn.net/100/446/747/products/img-9673-jpeg.jpg?v=1706266689597' WHERE id='banh-hoi';
UPDATE dishes SET image_url='https://www.vietnamairlines.com/content/dam/legacy-site-assets/SEO-images/2025%20SEO/Thay%20Anh%20Traffic%20Tieng%20Anh/vietnam%20food%20dishes/banh-xeo-is-popular-throughout-vietnam-especially-in-the-southern-and-central-regions.jpeg' WHERE id='banh-xeo';
UPDATE dishes SET image_url='https://image.vietnam.travel/sites/default/files/inline-images/shutterstock_382662007_0.jpg' WHERE id='banh-duc';
UPDATE dishes SET image_url='https://images.baodantoc.vn/uploads/2025/Thang-4/Ngay-4/Duy-Long/3t48.jpg' WHERE id='bun-bo-hue';
UPDATE dishes SET image_url='https://media.phunutoday.vn/files/content/2025/07/01/bun-ca-nau-sao-cho-ngon-1-1001.jpg' WHERE id='bun-ca';
UPDATE dishes SET image_url='https://image-fworker.momocdn.net/common/u/2e02fb5fe4f64fb55bc713540643c6f8eae702d101cea8c59afc49cfc505fc37/92315567-47fc-44dc-bb1c-826fe55126e1624ybmae.jpeg?referer=attachment.momocdn.net&size=XL' WHERE id='bun-mam';
UPDATE dishes SET image_url='https://img-global.cpcdn.com/recipes/3ac5e426317b0733/751x532cq70/bun-rieu-cua-d%E1%BB%93ng-recipe-main-photo.jpg' WHERE id='bun-rieu-cua-dong';
UPDATE dishes SET image_url='https://statics.vinpearl.com/bun-thang-hanoi-03_1689515457.jpeg' WHERE id='bun-thang';
UPDATE dishes SET image_url='https://img.tripi.vn/cdn-cgi/image/width%3D700%2Cheight%3D700/https%3A/gcs.tripi.vn/public-tripi/tripi-feed/img/473485NBK/image-2-cach-nau-chao-suon-thom-ngon-bocc89-duocc83ng-voi-cong-thuc-cucca3c-decc83-lam-165668309487429.jpg' WHERE id='chao-suon';
UPDATE dishes SET image_url='https://static.vinwonders.com/production/2025/02/com-ga-xoi-mo-ngon-nhat-sai-gon.jpg' WHERE id='com-ga-xoi-mo';
UPDATE dishes SET image_url='https://cdn.hstatic.net/files/200000700229/file/cach-lam-com-tron-han-quoc-5.jpg' WHERE id='com-tron';
UPDATE dishes SET image_url='https://bizweb.dktcdn.net/thumb/large/100/406/838/products/mien-ga-1-1-2.webp?v=1766486166870' WHERE id='mien-ga';
UPDATE dishes SET image_url='https://luhanhvietnam.com.vn/du-lich/vnt_upload/news/11_2021/pho-nem-nuong-le-loi-min.jpg' WHERE id='nem-nuong-nha-trang';
UPDATE dishes SET image_url='https://media.phunutoday.vn/files/news/2025/09/02/cach-lam-pho-tron-thit-bo-thanh-ngot-tuoi-mat-de-an-de-lam-232403.jpg' WHERE id='pho-tron';
UPDATE dishes SET image_url='https://storage.googleapis.com/onelife-public/blog.onelife.vn/2021/11/cach-lam-pho-tron-chua-ngot-mon-chinh-418842578612.jpg' WHERE id='pho-tron-chua-ngot';
UPDATE dishes SET name='Bún Bò Huế', portion_groups=replace(portion_groups::text,'Bún Bò Xứ Huế','Bún Bò Huế')::jsonb WHERE id='bun-bo-hue';
COMMIT;
