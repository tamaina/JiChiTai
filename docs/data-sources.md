# データの出典と生成

## 全国データセット

`pnpm geo:build` は、[e-Stat「市区町村名・コード」](https://www.e-stat.go.jp/municipalities/cities)から保存した`data/e-stat-standard-regions.csv`を自治体コード・正式名称・読みに使用します。自治体単体・都道府県詳細の境界は国土数値情報の行政区域を加工した[geolonia/japanese-admins](https://github.com/geolonia/japanese-admins)から取得し、ゲーム用SVGへ変換します。

全国地図の47都道府県には、[biskwikman/jpn-atlas](https://github.com/biskwikman/jpn-atlas)の統合済み`prefectures` TopoJSONを使用します。このデータは国土地理院「地球地図日本」（2016年）を基に投影・簡略化済みです。全国の概観表示だけに限定し、市区町村の選択・詳細・出題には使用しません。これにより、自治体境界から都道府県を実行時または生成時に再統合せず、内部境界や過度な簡略化による欠けを避けます。全国図の縮尺を読みやすく保つため、東京都は本土側の最大ポリゴンだけを描画し、島しょ部は省略します。

[国土数値情報「湖沼データ」（W09、2005年）](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-W09-2005.html)から概算面積10km²以上の湖沼・貯水池を選び、湖岸を約50m精度へ簡略化してから行政界ポリゴンより差し引きます。琵琶湖、霞ヶ浦など29湖沼の水面が自治体・都道府県SVGの穴になります。

政令指定都市の行政区は出題せず、区のポリゴンを統合した親市の輪郭を生成します。2024年再編前の旧浜松市7区も現在の浜松市へ統合します。東京都の特別区と北方領土6村は出題対象で、合計は1,747自治体です。投影には自治体中心緯度を標準緯線とする局所正距円筒図法を使い、SVG化前に簡略化します。東京都、鹿児島県、沖縄県の都道府県図は主要領域と全体図を併記します。

「人口トップ1000」フィルタは、独立行政法人統計センターの[教育用標準データセット SSDSE-A-2024](https://www.nstac.go.jp/use/literacy/ssdse/)に収録された2020年国勢調査の総人口を基準に、ゲーム収録自治体を降順に並べた上位1,000自治体です。

## 市外局番

`pnpm area-codes:build`は、地方公共団体情報システム機構（J-LIS）の「地方公共団体コード住所一覧」に掲載された代表電話番号から本庁の市外局番を抽出します。市町村合併後も一部地域だけ異なる市外局番を使う場合は、自治体の公式ページを出典として`data/area-code-overrides.csv`へ追加します。

代表局番と追加局番は区別して保持します。自治体から局番を答えるクイズではどちらも正解ですが、回答表示では本庁局番を先に示します。J-LISに掲載されない北方領土6村は市外局番クイズの対象外です。

## 市区町村章

`pnpm emblems:build`は、Wikidataの市区町村コード（P429）と紋章画像（P94）を対応付け、Wikimedia Commons APIで画像ごとのライセンスを確認します。Public domain、CC0、CC BY、CC BY-SAのいずれかを明示した画像だけをローカルへ保存します。

画像がない自治体や、自由利用できるライセンスを機械的に確認できない自治体は市区町村章クイズから除外します。作者名、ライセンス、Commons上の出典ページは各問題の回答表示から確認できます。

## 郵便番号

`pnpm postal-prefixes:build`は、日本郵便が公開する1レコード1行・UTF-8形式の全国郵便番号データを自治体コードで集約し、郵便番号の上3桁を生成します。政令指定都市の行政区は親市へまとめ、同じ自治体内に複数の上3桁がある場合はすべて保持します。

## 生成物

- `src/shared/data/generated-municipalities.ts`: 自治体・都道府県メタデータと配置座標
- `src/shared/data/generated-area-codes.ts`: 本庁代表電話、市外局番、追加局番と出典
- `src/shared/data/generated-emblems.ts`: 利用可能な市区町村章と作者・ライセンス・出典
- `src/shared/data/generated-postal-prefixes.ts`: 自治体別の郵便番号上3桁
- `src/shared/data/generated-national-map.ts`: jpn-atlasから生成した全国のクリック可能な都道府県パス
- `src/shared/data/population-top-1000.ts`: 2020年国勢調査人口による上位1,000自治体コード
- `public/generated/geometry/{code}.svg`: 自治体別SVG
- `public/generated/prefectures/{code}.svg`: 都道府県別SVG
- `public/generated/emblems/{code}.{svg,png,...}`: ライセンス確認済みの市区町村章
- `public/generated/maps/{prefectureCode}.json`: 都道府県別のクリック可能な市区町村パス
- `generated/national-dataset-metadata.json`: 入力データのURL・ハッシュ、生成日時、対象湖沼（Git管理対象外）

生成処理は行政界と湖沼データをネットワークから取得し、最大4GBのNode.jsヒープを使用します。生成後は`src/shared/data/generated-municipalities.ts`をPrettierで整形してください。
