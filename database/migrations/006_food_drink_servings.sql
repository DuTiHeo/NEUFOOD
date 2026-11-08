-- Count one food/drink portion per quantity; preserve historical order snapshots.
BEGIN;
UPDATE dishes SET eligible_servings=1
WHERE eligible_servings=0 AND id IN (
    'banh-bao',
    'banh-bot-loc',
    'banh-duc',
    'banh-trang-nuong',
    'banh-trang-phoi-suong',
    'banh-trang-tron',
    'ca-vien-chien-mam',
    'chan-ga-sa-tac',
    'che-anh-dep-trai',
    'goi-cuon',
    'khoai-tay-chien',
    'nem-chua-ran',
    'xien-ban',
    'coca-cola',
    'nuoc-sam',
    'pepsi',
    'sua-dau',
    'tra-chanh',
    'tra-da',
    'tra-dao-cam-sa',
    'tra-sua-tran-chau',
    'tra-tac'
);
COMMIT;
