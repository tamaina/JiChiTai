次のようなタイピングゲームを作りたい。コーディングエージェントに渡すための計画書を作って。

## ゲーム
ゲーム1: 市区町村の名前(と形)を見て、都道府県名をタイピングする。 e.g. 藤岡市 → gunmaken
ゲーム2: 市区町村の形を見て、都道府県名+市区町村名をタイピングする。 e.g. （藤岡市の形） → gunmakenfujiokashi

## ルール
共通:
入力が終わったらEnter。都道府県/市区町村でない入力はEnterで受け付けない。ローマ字の揺れにはなるべく対応する。

基本ルール(時間制限):
2分で正解した数を競う。間違った都道府県が入っても受け付ける。2分経ったらスコア表示。

練習用:
練習用の無限フリーモードも設定する。間違っていたら受け付けない。わからなかったら回答を表示できるようにする。終了したら履歴を一覧できるように。

## 実装

sorami/hokkaidle を参考にできるかも、というかシステム2はhokkaidleを発展させた感じだし。ShiKuChoSonはソースが見つからなかった。

- 市区町村の形のソースを見つけてSVGとかに変換するのが厄介なので、そこはエージェントに渡す前に丁寧に計画してあげて
  * 市区町村を都道府県に当てはめるようなアニメーションをさせたい...
  * 縮尺は、基本は画像表示枠いっぱいに形を表示するんだけど、枠線の太さを絶対値にしてある程度見てわかるようにしてもいいのかもしれない
- Cloudflare Workers。出題はWorkers APIが出してあげるとクライアントに優しいかも。10個ぐらいクライアントにランダムに選出したデータ(名前や形状データ)を渡して、残り3個になったらまたクライアントが要求するとか。既に解いた問題が重複しないように出題させないと。
1m 53s考えました

実装計画としてそのままコーディングエージェントに渡せる粒度まで落とします。まず hokkaidle の構成と、市区町村境界データの取得・変換・ライセンス条件を確認します。

取得したリポジトリメタデータとREADMEを確認

hokkaidle は Vite/Svelte に Turf・D3・TopoJSON を組み合わせた構成で、形状比較や地図上への配置演出の参考になります。次は実際のデータ配置と描画処理を追い、全国版でそのまま流用できる部分と作り直す部分を分けます。

クローンしたGitHubリポジトリでファイルを検索
検索を実施し複数のウェブサイトを参照
取得し表示したファイルとデータ整理
調査し複数のウェブサイトを検索

霊夢

コーディングエージェントが迷わないように、データ生成や出題APIまで含めて仕様を固めるのね？

魔理沙

そうだな。特に市区町村境界は、実行時に外部GISサービスへ問い合わせるのではなく、公式データからビルド時にゲーム用データを生成するETL工程として独立させるのが重要だぜ。

以下は、そのままエージェントへ渡せる計画書だ。

日本全国・市区町村タイピングゲーム 実装計画書
1. プロジェクト概要

日本全国の都道府県・市区町村を題材にした、ブラウザ向けタイピングゲームを実装する。

ゲームは次の2種類を提供する。

ゲーム1：市区町村から都道府県を回答

画面に次の情報を表示する。

市区町村名
市区町村の形状

ユーザーは、その市区町村が属する都道府県名をローマ字で入力する。

例：

表示:
藤岡市
［藤岡市の形状］

入力:
gunmaken
ゲーム2：形状から都道府県＋市区町村を回答

市区町村名は表示せず、市区町村の形状だけを表示する。

ユーザーは都道府県名と市区町村名を連結したローマ字を入力する。

例：

表示:
［藤岡市の形状］

入力:
gunmakenfujiokashi
2. 用語と出題単位
2.1 基本の出題対象

初期リリースでは、次を出題対象とする。

市
町
村
東京都の特別区

政令指定都市の行政区は、初期リリースでは原則として除外する。

理由：

政令指定都市の区は独立した地方公共団体ではない
「市区町村」の「区」が、特別区と行政区のどちらを指すか曖昧になる
横浜市港北区 のような回答形式を別途設計する必要がある
都道府県＋市区町村という現在の回答モデルにそのまま入らない

ただし、データ生成処理では政令指定都市の行政区も保持できる構造にして、将来次の追加モードを実装可能にする。

kanagawakenyokohamashikohokuku
2.2 廃止された自治体

通常モードでは、データ基準日時点で現存する自治体だけを扱う。

将来の追加機能として、次を検討できる。

平成の大合併以前モード
廃止自治体モード
特定年度の行政区域モード

現行自治体と廃止自治体を同じデータセットに混在させないこと。

3. ゲームモード

ゲーム種別とルール種別を独立させる。

type GameType =
  | "prefecture-from-municipality"
  | "municipality-from-shape"

type RuleMode =
  | "timed"
  | "practice"

これにより、次の4モードを作る。

市区町村名＋形状 → 都道府県、2分間
形状 → 都道府県＋市区町村、2分間
市区町村名＋形状 → 都道府県、練習
形状 → 都道府県＋市区町村、練習
4. 共通入力ルール
4.1 回答確定
入力後、Enterキーで回答を確定する
IME変換中のEnterは回答確定に使わない
KeyboardEvent.isComposing を確認する
空文字は受け付けない
前後の空白は除去する
ASCII英字以外の装飾文字は正規化する
4.2 「存在する地名か」の検証

Enterが押されたとき、入力内容を次の順序で処理する。

入力文字列を正規化
ローマ字別名辞書から候補を検索
現在のゲーム種別で有効な地名形式か判定
有効な地名なら正誤判定
有効な地名でなければ入力欄を維持し、問題を進めない

ゲーム1では、47都道府県のいずれかとして解釈できる入力のみ有効。

ゲーム2では、存在する「都道府県＋市区町村」の組み合わせとして解釈できる入力のみ有効。

したがって、時間制限モードで誤答として受け付けるのは、単なる任意文字列ではなく、別の実在する都道府県または自治体を入力した場合だけである。

例：

問題: 藤岡市

tokyoto
→ 有効な地名だが不正解。誤答として受け付ける。

foobar
→ 地名ではないため受け付けない。
4.3 入力後の挙動

有効な回答が確定したら、入力欄を空にする。

無効な回答の場合は、入力内容を消さない。エラー箇所を確認しやすくするためである。

連続入力を妨げないよう、回答後は必ず入力欄へフォーカスを戻す。

5. 時間制限モード
5.1 基本ルール
制限時間は120秒
カウント開始は、開始ボタンを押した時点
ページ表示時点では開始しない
制限時間内に正解した問題数をスコアとする
実在する別の地名を入力した場合も回答として受け付け、次の問題へ進む
誤答による減点は初期リリースでは行わない
同一セッション内で同じ問題を再出題しない
時間切れになった瞬間に入力を無効化する
時間切れ後に到着した回答リクエストはスコアへ加えない
5.2 記録項目
interface TimedGameResult {
  gameType: GameType
  startedAt: string
  finishedAt: string
  durationMs: number
  correctCount: number
  incorrectCount: number
  totalAnswered: number
  accuracy: number
  answers: AnswerHistoryItem[]
}
5.3 タイマー実装

表示上の残り時間を、単純な setInterval の呼び出し回数で管理しない。

開始時刻を performance.now() で保持し、毎フレームまたは一定間隔で次を計算する。

remainingMs = durationMs - (performance.now() - startedAt)

バックグラウンドタブでタイマーが間引かれても、経過時間がずれない設計にする。

5.4 スコア画面

最低限、次を表示する。

正解数
誤答数
回答総数
正答率
1分あたりの正解数
回答履歴
もう一度遊ぶボタン
モード選択へ戻るボタン

将来ランキング機能を追加する可能性はあるが、初期リリースではローカル記録だけでもよい。

6. 練習モード
6.1 基本ルール
制限時間なし
問題数制限なし
正解するまで次の問題へ進まない
実在する地名でも不正解なら受け付けない
「答えを見る」機能を提供する
任意の時点で終了できる
終了後に回答履歴を一覧表示する
6.2 不正解時

不正解の場合：

問題を変更しない
入力欄を維持する
不正解表示を出す
正解そのものは表示しない
入力欄へ再フォーカスする
6.3 答えを見る

「答えを見る」を押した場合：

正解の日本語表記を表示
標準ローマ字表記を表示
市区町村を都道府県内へ戻すアニメーションを実行
履歴に revealed: true を記録
正解数には加えない
「次の問題」ボタンで進める

誤操作を避けるため、「答えを見る」を押しただけで即座に次の問題へ進めない。

6.4 終了後の履歴
interface AnswerHistoryItem {
  questionId: string
  prefectureCode: string
  municipalityCode: string
  expectedCanonical: string
  enteredRaw: string | null
  enteredNormalized: string | null
  result: "correct" | "incorrect" | "revealed" | "timeout"
  elapsedMs: number
  answeredAt: string
}

履歴一覧には次を表示する。

出題された自治体
都道府県
ユーザーの入力
正解表記
正誤
答えを見たか
回答時間
7. ローマ字入力の設計
7.1 基本方針

自由な曖昧一致や編集距離による判定ではなく、自治体ごとに受理可能な別名を事前生成する。

理由：

誤字まで正解扱いする境界が不明確になる
別自治体の正しい入力と衝突する可能性がある
スコア競技として判定が不安定になる
クライアントとサーバーで同じ判定を再現しにくい
7.2 正規化

最低限、次を行う。

function normalizeRomanInput(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’'‐-‒–—―ー・.\s_-]/g, "")
}

全角英字、大文字小文字、空白、ハイフン、アポストロフィなどを吸収する。

7.3 対応する揺れ

少なくとも次を検討する。

し：shi, si
ち：chi, ti
つ：tsu, tu
ふ：fu, hu
じ：ji, zi
しゃ：sha, sya
しゅ：shu, syu
しょ：sho, syo
ちゃ：cha, tya, cya
じゃ：ja, jya, zya
づ：zu, du
長音の省略・母音表記
撥音「ん」の n と、必要箇所での nn
小さい「っ」による子音重複
m の前の「ん」を m とする表記
外来音や地域固有読みの特例

ただし、すべてを機械的な組み合わせで展開すると別名数が爆発する。次の二段構成にする。

共通変換規則から別名を生成
自治体固有の追加別名を手動データで補う
interface MunicipalityReading {
  kana: string
  canonicalRoman: string
  acceptedRomans: string[]
}
7.4 行政種別の接尾辞

標準回答では行政種別を含める。

群馬県       gunmaken
東京都       tokyoto
大阪府       osakafu
北海道       hokkaido

藤岡市       fujiokashi
榛東村       shintomura
甘楽町       kanramachi
新宿区       shinjukuku

市区町村名に行政種別が含まれない入力を許可するかは設定化する。

初期設定の推奨：

都道府県の接尾辞は必須
市・区・町・村の接尾辞も必須
表示上は正規表記を案内する
カジュアル設定として接尾辞省略を将来追加可能にする
7.5 町の読み

「町」は自治体によって machi と cho が異なる。

漢字から推測せず、自治体マスターに正式な読みを持たせる。

7.6 同名自治体

ゲーム2では都道府県名と市区町村名を連結するため、同名自治体を一意に識別できる。

内部判定は文字列だけでなく、別名から自治体コードへの索引を作る。

Map<string, MunicipalityCode[]>

別名が複数自治体に衝突した場合は、都道府県を含む完全な回答だけを有効とする。

8. 行政区域データの取得
8.1 推奨ソース

主データには国土交通省の「国土数値情報 行政区域データ」を使用する。

このデータには、都道府県名、市区町村名、行政区名、行政区域コードなどが含まれる。データは定期的に更新されるため、取得年度を固定せず、ETL設定に基準日とダウンロード元を明記する。

アプリの実行中に国土交通省サイトへアクセスするのではなく、開発・リリース時に取得してゲーム用データへ変換する。

8.2 データの出典管理

生成データには次のメタデータを付与する。

{
  "source": "国土数値情報 行政区域データ",
  "sourceOrganization": "国土交通省",
  "sourceDate": "YYYY-01-01",
  "downloadedAt": "ISO-8601",
  "sourceUrl": "...",
  "processed": true,
  "processingVersion": "git commit hash"
}

アプリ内のクレジット画面にも、出典と加工済みであることを記載する。

例：

「国土数値情報（行政区域データ）」（国土交通省）を加工して作成

利用規約はデータ取得時点の最新版を確認し、リポジトリに取得日と確認内容を記録する。

8.3 補助ソース

自治体名、読み、全国地方公共団体コードの照合には、総務省の全国地方公共団体コードを使用する。

境界データ内の名称だけに依存せず、次のマスターを別に管理する。

全国地方公共団体コード
都道府県名
市区町村名
かな表記
行政種別
有効開始日
有効終了日
ローマ字別名
8.4 Geoloniaのデータについて

geolonia/japanese-admins は、国土数値情報から自治体別GeoJSONを生成する実装例として参考にできる。

ただし、次の理由から、本プロジェクトでは原則として自前ETLを持つ。

更新時期を自分で管理したい
簡略化率をゲーム向けに調整したい
都道府県内への配置アニメーション用データが必要
自治体の除外・統合方針を管理したい
元データと生成物の対応関係を記録したい

Geoloniaの生成スクリプトは参考実装として調査してよいが、公開エンドポイントを本番の唯一の依存先にはしない。

9. 境界データETL

ETLはフロントエンドビルドとは分離し、明示的なコマンドで実行する。

例：

packages/
  web/
  worker/
  shared/
  geo-pipeline/

コマンド例：

pnpm geo:download
pnpm geo:extract
pnpm geo:validate
pnpm geo:build
pnpm geo:test
9.1 ETL処理順序
Step 1：元データ取得
行政区域データのZIPをダウンロード
SHA-256を計算
取得元URL、取得日、ファイルサイズを記録
元データはGitへ直接コミットしない
ローカルキャッシュまたはCIのキャッシュに保存
Step 2：読み込み

GDALまたはGeoPandasを使用して読み込む。

推奨は、再現性と実績を優先して以下のいずれかとする。

Python + GeoPandas + Shapely
GDAL/OGR CLI
Node.js + mapshaper CLI

JavaScriptだけでGML/Shapefileの全処理を完結させることを目標にしない。

Step 3：属性正規化

内部形式を次に統一する。

interface RawAdministrativeFeature {
  prefectureCode: string
  prefectureName: string
  municipalityCode: string | null
  municipalityName: string | null
  districtName: string | null
  designatedCityWardName: string | null
  geometry: Polygon | MultiPolygon
}
Step 4：自治体単位で結合

同じ自治体コードに複数ポリゴンがある場合、dissolve または union する。

離島、飛び地、湖による分断を失わないよう、出力は MultiPolygon を許容する。

自治体コードが欠損している領域は、自動的に既存自治体へ割り当てない。検証レポートへ出力して手動確認する。

Step 5：ジオメトリ修復

次を実施する。

不正ポリゴンの検出
必要に応じて make_valid
自己交差の解消
空ジオメトリの除外
GeometryCollectionのPolygon/MultiPolygon化
座標系の確認
面積が異常に小さい断片のレポート

小島を一律に削除しない。島そのものが自治体判別の特徴になるためである。

Step 6：都道府県ジオメトリ生成

各都道府県について、所属自治体を結合して都道府県外形を生成する。

用途：

正解後の配置アニメーション
都道府県内の位置表示
ゲーム1の補助演出
検証用プレビュー
Step 7：簡略化

表示用途ごとに複数段階を生成する。

detail:
  quiz       問題表示用
  prefecture 都道府県配置用
  thumbnail  履歴一覧用

簡略化はトポロジーを壊しにくい方式を使う。

候補：

MapshaperのVisvalingam簡略化
TopoJSON生成時の量子化
Shapelyのpreserve_topology付きsimplify

単純な「元座標の何％を残す」という固定値だけで決めず、次を基準に評価する。

ファイルサイズ
頂点数
元形状との面積差
Hausdorff距離
小島の欠落
人間が見たときの識別可能性
Step 8：ゲーム表示用座標生成

各自治体について次を計算する。

地理座標のジオメトリ
バウンディングボックス
重心
表示用中心
都道府県内での位置
クイズ枠にフィットさせる変換行列
都道府県表示時の変換行列

重心が自治体外へ出る場合があるため、ラベル位置には必要に応じて pointOnSurface を使用する。

Step 9：Web用データ出力

推奨出力：

generated/
  metadata.json
  municipalities.json
  prefectures.json
  aliases.json
  geometry/
    quiz/
      10209.json
    thumbnail/
      10209.json
  prefecture-geometry/
    10.json

自治体ごとの個別ファイル、または都道府県ごとのパックにする。

全国全自治体の高詳細GeoJSONを、最初のページロードで一括配信しない。

Step 10：検証ページ生成

開発用に全自治体を一覧表示するページを作る。

確認項目：

自治体名
コード
形状
頂点数
データサイズ
面積
島の数
都道府県内の配置
標準ローマ字
受理可能な別名

問題のある自治体を自動検出し、一覧上で警告する。

10. SVG・形状表示
10.1 SVGファイルを大量生成するか

各自治体を完全なSVG文書として保存する必要はない。

推奨方式は、ゲーム用に簡略化した座標またはSVGの path d をデータとして保持し、Vueコンポーネント内の共通SVGへ描画する方式である。

例：

{
  "code": "10209",
  "viewBox": [0, 0, 1000, 1000],
  "paths": [
    "M..."
  ]
}

利点：

色や線幅をCSSで変更できる
アニメーションしやすい
SVG文書の重複部分を削減できる
DOMへ直接配置できる
サムネイルと問題表示で再利用できる

GeoJSONからブラウザで毎回投影する方式でもよいが、初期表示速度と再現性を考えると、ビルド時にSVGパスへ変換する方が扱いやすい。

10.2 問題表示時の拡大

自治体の形は、形状のバウンディングボックスを基準に問題枠へフィットさせる。

padding = 枠の短辺の8〜12%
scale = min(
  availableWidth / geometryWidth,
  availableHeight / geometryHeight
)

自治体の実際の面積比は問題表示には反映しない。

小さい自治体も大きい自治体も、基本的には表示枠いっぱいに表示する。

10.3 枠線の太さ

拡大率に応じて枠線まで太くならないよう、次を使用する。

.municipality-shape {
  vector-effect: non-scaling-stroke;
  stroke-width: 2px;
  stroke-linejoin: round;
  stroke-linecap: round;
}

または、ズーム倍率に応じて stroke-width を逆補正する。

hokkaidle でもズーム変換に対して線幅を逆補正しており、この発想は流用できる。

問題表示では絶対的な線幅を保ち、細長い自治体や小島も視認できるようにする。

10.4 小島・飛び地

MultiPolygonを1つの図形として同じバウンディングボックスへ収める。

ただし、本土から非常に遠い離島によって本体が極端に小さくなる自治体がある。

その場合に備えて、自治体ごとに表示方式を設定可能にする。

type GeometryDisplayMode =
  | "geographic"
  | "inset-islands"
  | "manual-layout"

初期実装では地理的位置を維持する。

視認性が著しく悪い自治体だけ、離島を小窓へ移す手動レイアウトを許可する。ただし、クイズの難易度へ影響するため、適用自治体を明示的なデータとして管理する。

11. 都道府県へ当てはめるアニメーション
11.1 演出概要

正解時または「答えを見る」使用時に、問題枠いっぱいに拡大されていた自治体を、その都道府県内の本来の位置へ移動させる。

アニメーションの流れ：

自治体単体を問題枠いっぱいに表示
正解を強調
都道府県全体の薄いシルエットをフェードイン
自治体を縮小しながら本来の位置へ移動
該当自治体だけ色を変えて強調
自治体名と都道府県名を表示
次の問題へ移行
11.2 実装原理

自治体と都道府県を、同じ地理座標から生成したSVGパスとして保持する。

同じパスに対し、表示状態ごとに異なる変換行列を適用する。

interface ShapeTransform {
  translateX: number
  translateY: number
  scale: number
}

状態：

quizTransform
prefectureTransform

アニメーション：

transform: translate(...) scale(...);
transition:
  transform 900ms cubic-bezier(...),
  fill 300ms,
  opacity 300ms;

SVGパスそのものを別形状へモーフィングさせる必要はない。

同じ自治体パスの transform を補間すればよいため、頂点数の一致問題を避けられる。

11.3 座標変換

ETLで次を事前計算する。

単体表示用フィット変換
都道府県表示用投影変換
都道府県SVGのviewBox
自治体の都道府県内バウンディングボックス

ブラウザ側で毎回GIS計算をしない。

11.4 アクセシビリティ

prefers-reduced-motion: reduce の場合：

移動アニメーションを省略
即座に都道府県内位置へ切り替える
点滅や大きな拡縮を行わない
12. hokkaidle から参考にする部分

hokkaidle は、Vite/SvelteにD3、Turf、TopoJSONを組み合わせた構成である。

参考にできる部分：

TopoJSONからGeoJSON Featureへ変換する処理
D3投影と geoPath
fitExtent による表示領域へのフィット
SVGパスによる行政区域描画
バウンディングボックスへズームする処理
ズーム時の線幅逆補正
地域コードと形状を対応させるデータ構造
正解自治体へズームする演出

hokkaidle は、起動時に cities.json と北海道全体のTopoJSONを読み、D3で市町村コードとFeatureを対応付けている。

今回そのまま流用しない部分：

全国の形状を一括ロードする方式
クライアントだけで無制限にランダム選択する方式
地図上をクリックして回答するUI
Svelte固有のコンポーネント構造
1ラウンド完結型のゲーム状態

今回のゲームではVueを前提とし、出題セッション、先読みキュー、タイピング判定を中心に再設計する。

13. システム構成

推奨構成：

Cloudflare Workers
├── Vueフロントエンド
├── Hono API
├── 静的形状データ
├── D1（必要になった場合）
└── Analytics Engine（任意）

モノレポ例：

apps/
  web/
  worker/

packages/
  shared/
  romaji/
  geo-pipeline/
  game-core/

data/
  manual/
    readings.json
    aliases.json
    geometry-overrides.json

generated/
  municipalities.json
  prefectures.json
  geometry/

使用技術：

TypeScript
Vue 3
Vite
Hono
Cloudflare Workers
ValibotまたはZod
Vitest
Playwright
SVG
Python/GeoPandasまたはGDALによるETL
14. クライアントとWorkers APIの責務
14.1 基本方針

Workers APIは、問題の選択とセッション管理を担当する。

形状データ本体は、原則として不変の静的アセットとして配信する。

Workersが毎回GeoJSON全文をJSONレスポンスへ埋め込む方式は避ける。

理由：

同じ形状を何度も送る
APIレスポンスが大きくなる
CDNキャッシュを使いにくい
問題APIと形状データの更新周期が異なる
WorkersのCPU時間を使って毎回加工する必要がない

APIからは形状URLまたは形状IDを返し、クライアントが先読みする。

14.2 問題バッチ

開始時に10問程度を返す。

残り3問になったら、クライアントは次のバッチを要求する。

interface QuestionBatchResponse {
  sessionId: string
  batchId: string
  questions: QuestionPayload[]
  exhausted: boolean
}
interface QuestionPayload {
  questionId: string
  municipalityCode: string
  prefectureCode: string

  // ゲーム1でのみ表示
  municipalityDisplayName?: string

  shape: {
    quizUrl: string
    prefectureUrl: string
    geometryVersion: string
  }

  animation: {
    quizTransform: ShapeTransform
    prefectureTransform: ShapeTransform
  }
}
14.3 正解情報の露出

完全な不正解防止はできない。ブラウザゲームである以上、通信やJavaScriptを調べれば回答を取得できる。

ただし、通常操作で答えが見えない設計にする。

ゲーム1では自治体名から都道府県が推測可能なので、APIレスポンスにコードが含まれても競技性への追加影響は小さい。

ゲーム2では、問題受信時に日本語自治体名や正解ローマ字を返さない。

正解判定は次のどちらかとする。

初期リリース推奨：

クライアントに回答辞書を持たせる
入力レスポンスを高速化する
オフライン練習へ発展しやすくする
ランキングは正式記録として扱わない

ランキング導入時：

回答確定ごとにWorkersへ送信
サーバー時刻で制限時間を判定
セッションごとの出題順をサーバーで保持または署名
スコアをサーバー側で再計算
15. 重複しない出題
15.1 セッション内シャッフル方式

出題対象コード一覧をサーバー側でシード付きシャッフルし、カーソルで順番に切り出す。

概念：

interface GameSession {
  sessionId: string
  seed: string
  gameType: GameType
  ruleMode: RuleMode
  filters: QuestionFilters
  cursor: number
  startedAt: number
  expiresAt: number
}

Workersがセッション状態を完全に保存しなくても、署名付きトークンに次を含められる。

interface SessionTokenPayload {
  version: 1
  seed: string
  cursor: number
  datasetVersion: string
  gameType: GameType
  ruleMode: RuleMode
  filtersHash: string
  issuedAt: number
  expiresAt: number
}

次回バッチ要求時にカーソルを進め、新しい署名付きトークンを返す。

同じシードとシャッフルアルゴリズムを使えば、解答済みID一覧を毎回送らなくても重複を防げる。

15.2 シャッフルアルゴリズム

JavaScript標準の Math.random() に依存しない。

共通パッケージに、シード付きPRNGとFisher–Yatesシャッフルを実装する。

クライアントとサーバーで同じ結果を再現する必要がなければ、Workers側だけで実装してもよい。

15.3 問題数を使い切った場合

練習モードで全問を使い切った場合：

exhausted: true を返す
「全問終了」を表示
同じセッションで再シャッフルしない
新しい周回を始める場合は明示的に新セッションを作る
16. API案
16.1 セッション開始
POST /api/game-sessions
{
  "gameType": "municipality-from-shape",
  "ruleMode": "timed",
  "filters": {
    "prefectureCodes": [],
    "municipalityTypes": ["city", "town", "village", "special-ward"]
  }
}

レスポンス：

{
  "sessionId": "...",
  "sessionToken": "...",
  "datasetVersion": "2026-01-01.v1",
  "durationMs": 120000,
  "questions": []
}
16.2 次の問題取得
POST /api/game-sessions/:sessionId/questions
{
  "sessionToken": "...",
  "count": 10
}

レスポンスでは更新済みの sessionToken を返す。

同一トークンの再送については、同じバッチを再返却できるよう batchId またはリクエストIDを使う。

16.3 回答送信

ランキングなしの初期版では、必須APIにしなくてもよい。

サーバー判定を行う場合：

POST /api/game-sessions/:sessionId/answers
{
  "sessionToken": "...",
  "questionId": "...",
  "answer": "gunmakenfujiokashi",
  "clientElapsedMs": 5321
}

レスポンス：

{
  "validPlaceName": true,
  "correct": true,
  "canonicalAnswer": "gunmakenfujiokashi",
  "displayAnswer": "群馬県藤岡市",
  "finished": false
}
16.4 答えを見る
POST /api/game-sessions/:sessionId/questions/:questionId/reveal

練習モード以外では拒否する。

17. フロントエンド状態管理

Piniaを導入してもよいが、ゲーム状態はまず単一のComposableへ集約する。

interface GameState {
  phase:
    | "idle"
    | "loading"
    | "countdown"
    | "playing"
    | "feedback"
    | "finished"

  config: GameConfig
  session: GameSessionClientState | null
  currentQuestion: QuestionPayload | null
  queue: QuestionPayload[]
  history: AnswerHistoryItem[]
  input: string
  remainingMs: number
}

主要Composable：

useGameSession()
useQuestionQueue()
useGameTimer()
useRomanInput()
useShapeAnimation()
useGameHistory()

ゲームロジックとVueコンポーネントを分離し、game-core パッケージの純粋関数としてテストできるようにする。

18. 問題キューと先読み
18.1 動作
セッション開始時に10問取得
先頭の問題を表示
残り3問以下になったら補充要求
同時に複数の補充要求を出さない
次の問題の形状を先読み
現在＋次の2〜3問分だけ高優先度で取得
それ以降は低優先度またはアイドル時に取得
18.2 通信失敗

問題キューに残りがある場合はゲームを継続する。

キューが空になった場合：

タイマーを止めるかどうかを仕様化する
推奨は、通信障害をユーザーの不利にしないため一時停止
再接続後に再開
ランキング導入時はサーバー時刻との整合が必要

同じ batchId への再試行では、同じ問題を返す。

19. 画面構成
/
  トップ・ゲーム説明

/play
  モード選択

/play/timed/prefecture
/play/timed/municipality
/play/practice/prefecture
/play/practice/municipality

/result/:localResultId
  結果・履歴

/about
  遊び方・出典・ライセンス
ゲーム画面

上から順に：

残り時間または練習中表示
スコア
問題番号
市区町村名（ゲーム1のみ）
形状表示枠
入力欄
エラー・正誤フィードバック
答えを見る（練習のみ）
終了ボタン（練習のみ）

入力中にレイアウトが動かないよう、フィードバック領域の高さを確保する。

20. ローカル保存

初期リリースではIndexedDBまたはlocalStorageに次を保存する。

ベストスコア
最近のゲーム結果
練習履歴
設定
データセットバージョン

履歴件数には上限を設ける。

例：

ゲーム結果：最新100件
詳細回答履歴：最新20ゲーム分

データセット更新時も過去履歴を表示できるよう、履歴には自治体名をスナップショットとして保存する。

21. テスト計画
21.1 ローマ字テスト
全都道府県の標準入力
全自治体の標準入力
ヘボン式・訓令式の代表的な揺れ
長音
撥音
促音
machi / cho
同名自治体
無効文字列
別自治体を入力した場合
大文字・全角・空白入り

生成した全別名について衝突検査を行う。

alias collision report

をCI成果物として出力する。

21.2 GISデータテスト
全対象自治体にコードがある
自治体コードが重複していない
全自治体に有効なジオメトリがある
全自治体が所属都道府県内におおむね収まる
面積が0ではない
SVGパスが空でない
NaNまたはInfinityを含まない
viewBoxが正
簡略化後も小島数が不自然に減っていない
自治体マスターと境界データの差分が説明可能
21.3 ゲームロジックテスト
有効な不正解は時間制限モードで次へ進む
無効文字列は進まない
練習モードの不正解は進まない
正解でスコアが1増える
revealは正解数へ加算しない
同じ問題が再出題されない
120秒後の回答が加算されない
IME変換中のEnterで送信されない
21.4 E2E

Playwrightで次を確認する。

キーボードだけでゲームを完結できる
連続回答できる
残り3問で補充される
通信再試行
時間切れ
練習終了と履歴
モバイル表示
Reduced Motion
ブラウザのタブを一時的にバックグラウンドへ移した場合
22. パフォーマンス目標

暫定目標：

初期JavaScript転送量：gzip後250KB前後を目標
最初の問題を開始できるまで：通常回線で2秒以内を目標
問題切り替え：キャッシュ済みなら100ms以内
形状ファイル：大多数をgzip後数KB程度に抑える
10問分の問題マニフェスト：数十KB未満
入力から判定表示：50ms以内
60fpsを大きく損なわないSVGアニメーション

極端に複雑な自治体形状には、別の簡略化レベルを設定できるようにする。

23. セキュリティと不正対策

初期リリースでランキングを実装しない場合、強い不正対策は不要。

最低限：

API入力をスキーマ検証
バッチ数に上限
セッショントークンへHMAC署名
有効期限
レート制限
データセットバージョン検証
クライアントから送られたスコア値を信用しない

ランキング導入時：

Workers側で開始・終了時刻を管理
問題順をサーバー側で確定
回答履歴からスコアを再計算
同一問題への複数回答を拒否
異常な回答速度を記録
Turnstile導入を検討
クライアントだけの結果を公式ランキングへ登録しない

ただし、ブラウザへ問題を配信する以上、完全なカンニング防止は目標にしない。

24. 実装フェーズ
Phase 0：仕様固定
出題対象の自治体区分を確定
接尾辞省略を許可するか確定
政令指定都市の区の扱いを確定
ローマ字変換方針を確定
ランキングを初期版に入れるか確定

成果物：

docs/game-rules.md
docs/romanization.md
Phase 1：データ調査用プロトタイプ
国土数値情報を取得
1都道府県だけ変換
GeoJSONからSVGパスを生成
単体表示
都道府県内への移動アニメーション
MultiPolygonと離島を確認

群馬県など、本土・山間部・比較的小さい自治体を含む都道府県で試す。

北海道、東京都、長崎県、沖縄県も早期に確認する。

完了条件：

藤岡市などを単体表示できる
群馬県内の正しい位置へアニメーションできる
線幅が拡大率に影響されない
Phase 2：全国ETL
全国データ変換
自治体マスター生成
読みデータ統合
簡略化
検証レポート
プレビューサイト

完了条件：

全対象自治体が一覧表示できる
欠損・重複がない
エラー自治体がレポート化されている
Phase 3：ゲームコア
入力正規化
別名辞書
正誤判定
時間制限ルール
練習ルール
履歴
単体テスト

この段階では固定問題データでもよい。

Phase 4：Vue UI
モード選択
問題画面
SVG描画
アニメーション
スコア画面
練習履歴
キーボード操作
モバイル対応
Phase 5：Workers API
セッション開始
シード付き出題
バッチ取得
重複防止
署名付きトークン
静的形状ファイル配信
エラー処理
Phase 6：品質改善
全自治体の表示確認
ローマ字別名の追加
難読自治体の読み確認
パフォーマンス測定
アクセシビリティ
E2E
出典・ライセンス画面
25. 最初に作る縦切りプロトタイプ

最初から全国データや全画面を実装しない。

次の最小構成を先に完成させる。

対象：

群馬県
藤岡市を含む10自治体程度

実装内容：

ETLで自治体別SVGパスを生成
藤岡市の形を枠いっぱいに表示
gunkmaken ではなく gunmaken を正解判定
tokyoto は有効な誤答として扱う
foobar は無効として問題を進めない
正解時に藤岡市を群馬県内へ移動
10問バッチをWorkersから取得
残り3問で次を取得
同一問題を再出題しない
2分タイマーと結果画面を実装

この縦切りが完成してから全国ETLへ拡張する。

26. 実装上の重要な禁止事項
元の全国行政区域データをそのままクライアントへ配信しない
毎問題、Workers上でGIS変換しない
全国全形状を初回ロードしない
Math.random() だけで重複管理しない
市区町村名の漢字から読みを自動推測しない
「町」を一律に machi または cho としない
ポリゴンの小片を面積だけで無条件削除しない
タイマーをinterval回数だけで管理しない
クライアントが送ったスコアを公式記録として信用しない
SVGの枠線を拡大縮小に任せない
GeoJSONと自治体マスターの差異を黙って補正しない
27. Definition of Done

初期リリースは、次をすべて満たしたら完成とする。

2種類のゲームを遊べる
時間制限モードと練習モードがある
Enterで回答できる
実在しない地名入力は受け付けない
時間制限モードでは有効な誤答でも次へ進む
練習モードでは正解まで次へ進まない
練習モードで答えを表示できる
練習終了後に履歴を確認できる
代表的なローマ字の揺れに対応している
全対象自治体に形状がある
市区町村を都道府県内へ戻す演出がある
先読みバッチで問題を取得する
セッション内で問題が重複しない
モバイルとデスクトップで操作できる
キーボードだけで操作できる
出典と加工表示がある
GISデータ生成を再現できる
ローマ字・ゲームロジック・ETLの自動テストがある
28. コーディングエージェントへの最初の指示

まずコードを書き始めるのではなく、以下を実行すること。

この計画書から未確定事項を docs/open-questions.md に抽出する
sorami/hokkaidle のデータ生成・D3描画部分を調査する
国土数値情報の最新行政区域データの属性定義と利用条件を確認する
群馬県だけを対象にしたETLプロトタイプを作る
藤岡市単体から群馬県内への配置アニメーションを作る
成果物のファイルサイズ、頂点数、処理時間をレポートする
全国展開前に、ETL方式とデータ形式についてADRを書く

必要なADR：

docs/adr/
  0001-administrative-boundary-source.md
  0002-geometry-output-format.md
  0003-romanization-policy.md
  0004-question-session-model.md
  0005-designated-city-wards.md

最初のプルリクエストでは、完成したゲームではなく、次だけを提出すること。

データ取得スクリプト
群馬県の変換スクリプト
生成物の検証テスト
藤岡市の表示デモ
都道府県内配置アニメーション
ADR
再現手順

魔理沙

hokkaidle は、自治体情報を cities.json から読み込み、TopoJSONのFeatureを自治体コードで索引化し、D3の fitExtent と geoPath で描画している。正解自治体のバウンディングボックスへズームする実装や、ズーム率に応じた線幅補正は今回も参考になるぜ。

境界データについては、国土数値情報の行政区域データが都道府県名、市区町村名、行政区名、地方公共団体コードを持つため、主データに適している。2026年版についても、2026年1月1日基準のデータが公開されたことを確認できる。

また、Geoloniaの japanese-admins は国土数値情報から自治体別GeoJSONを生成する構成なので、ETLの参考資料として有用だ。ただし更新管理や簡略化、アニメーション用メタデータの都合から、生成工程自体はプロジェクト側で持つ案にしている。

国土数値情報や関連する地理データを加工して公開する際は、利用時点の規約確認と出典表示を実装タスクに含めるべきだ。加工データを公的機関が作った未加工データのように表示しない点にも注意が必要になる。

情報源
コーディングエージェントに"こざっぱりした"UIを作らせるためにはどういう指示やskillを使った方がいいのかしら

霊夢

「こざっぱりしたUI」とだけ書くと、エージェントが勝手にカードを増やしたり、グラデーションや巨大見出しを足したりしそうなのよね。

魔理沙

そうなんだぜ。
clean、modern、minimal のような形容詞だけでは曖昧すぎる。

コーディングエージェントには、見た目の雰囲気よりも、

何を禁止するか
画面の情報密度
余白とサイズの数値
コンポーネントの種類
参考にする既存UI
完成後の検査方法

を指定した方が安定する。

まず専用Skillを作る

プロジェクト内に、たとえば次のようなSkillを置くとよい。

.agent/skills/plain-ui/SKILL.md

Claude Code系なら .claude/skills/plain-ui/SKILL.md、汎用的に運用するなら docs/ui-design-guidelines.md として置き、AGENTS.md から参照させてもよい。

内容はこんな形が使いやすい。

Plain UI Skill
Purpose

このプロジェクトでは、装飾性よりもゲームの視認性、入力速度、情報の把握しやすさを優先する。

UIは「こざっぱりした道具」として設計すること。マーケティング用ランディングページのような演出は行わない。

Visual direction

目標とする印象：

軽い
素直
静か
情報の所在が明確
デスクトップアプリや小さなWebツールに近い
長時間使っても疲れにくい

避ける印象：

SaaSの管理画面
スマートフォンアプリ風の巨大カードUI
ゲーム配信サイト風の派手なUI
AIが生成したテンプレート的なランディングページ
子供向け教材のような過剰な装飾
Layout rules
メインコンテンツ幅は min(100% - 32px, 720px) を基本とする
ゲーム画面は原則として1カラムにする
主要操作を画面中央付近へまとめる
同時に表示する主要アクションは最大3個
余白は4px単位で管理する
基本の間隔は 8px / 12px / 16px / 24px / 32px
セクション間隔を不必要に広げない
各要素をカードで囲まない
背景色の異なるパネルは、情報グループを区別する必要がある場合だけ使う
入れ子のカードは禁止
ページ全体をカードで囲まない
Typography
本文はシステムフォントを使う
本文サイズは原則 16px
補足は 13px または 14px
ゲーム中の入力欄は 20px から 24px
見出しの階層は最大3段階
ページタイトルを過剰に巨大化しない
font-weight: 700 を多用しない
本文の標準ウェイトは400
強調は500または600を基本とする
英字を装飾目的で大文字化しない
Color
基本色は背景、前景、境界線、アクセントの4系統以内
グラデーションは禁止
発光表現は禁止
半透明ガラス表現は禁止
背景に装飾的な模様を置かない
アクセント色は主要操作と選択状態だけに使う
正解、不正解、警告は意味が区別できる色を使う
色だけに状態を依存させない
ダークモードでも彩度を上げすぎない
Borders and shadows
基本の境界線は 1px solid
角丸は原則 6px から 10px
ピル型UIはタグや短い状態表示だけに使う
すべてのボタンを完全な丸型にしない
シャドウは原則使わない
使用する場合も、ごく薄い1段階だけにする
複数段のドロップシャドウは禁止
Buttons
主ボタン、通常ボタン、テキストボタンの3種類以内
主ボタンは1画面に原則1個
ボタンの高さは 36px から 44px
アイコンだけのボタンにはラベルまたはaria-labelを付ける
ボタン内に不要なアイコンを追加しない
主要操作に絵文字を使わない
ホバー時に大きく移動・拡大させない
Forms
入力欄は常にラベルまたは明確な文脈を持たせる
プレースホルダーだけをラベルとして使わない
フォーカスリングを消さない
エラー表示でレイアウトを大きく動かさない
タイピングゲームでは入力欄を最優先要素として扱う
ゲーム中は回答入力欄へ常に戻りやすくする
Animation
アニメーションは状態変化を理解するためにだけ使う
通常の遷移は 120ms から 220ms
正解時の地図配置アニメーションのみ、最大 900ms
常時動き続ける装飾は禁止
背景アニメーションは禁止
ホバー時の浮遊表現は禁止
prefers-reduced-motion に対応する
Components

積極的に使ってよい：

単純なヘッダー
タブ
セグメント切り替え
ラベル付き入力欄
控えめな進捗表示
小さなステータス表示
通常のテーブルまたはリスト
ネイティブ要素に近いダイアログ

慎重に使う：

カード
モーダル
ドロップダウン
トースト
アイコン
チップ

原則として使わない：

ヒーローセクション
Bento Grid
大型の数値カード
背景グラデーション
ガラス調パネル
3Dアイコン
装飾目的のイラスト
カルーセル
不要なサイドバー
ゲーム画面の下部ナビゲーション
Game-specific rules

ゲーム画面の優先順位：

問題の形
市区町村名
回答入力欄
残り時間とスコア
フィードバック
補助操作
残り時間とスコアを巨大なカードにしない
問題形状の周囲に過剰なフレームを付けない
回答入力欄の横に不要な送信ボタンを置かない。Enterで回答する
正解演出で紙吹雪を常用しない
不正解時に画面全体を揺らさない
ゲーム中に説明文を大量表示しない
補足説明は開始前またはヘルプへ移す
練習モードの「答えを見る」は主ボタンより弱い見た目にする
Implementation rules
デザイントークンをCSS変数として定義する
コンポーネント内へ任意の色や余白を直接追加しない
アイコンライブラリを必要以上に導入しない
CSSフレームワークの既定デザインをそのまま使わない
UIライブラリを使う場合も、このSkillに合わせて見た目を抑える
レスポンシブ化のためだけにDOMを重複させない
HTMLの意味構造とキーボード操作を優先する
Review checklist

実装後、各画面について次を確認する。

カードを減らせないか
見出しを小さくできないか
アイコンを削除できないか
説明文を短くできないか
余白が広すぎないか
主ボタンが複数競合していないか
色数が増えすぎていないか
画面内で最も目立つものが、本当に主要操作か
320px幅でも横スクロールしないか
キーボードだけで操作できるか
ライトモードとダークモードの両方で境界が判別できるか

迷った場合は、要素を追加するのではなく削除すること。

ゲーム固有の指示も別途渡す

Skillは汎用ルールなので、タスクごとのプロンプトでは画面構造まで固定する。

この画面は、派手なゲームUIではなく、軽量な地理学習ツールとして実装してください。

Plain UI Skill を必ず適用してください。

ゲーム画面の構成

上から順に、以下だけを配置してください。

小さなヘッダー
残り時間と正解数を1行で表示
市区町村名
市区町村形状のSVG表示枠
回答入力欄
固定高さのフィードバック領域
練習モードの場合だけ補助操作

画面全体の最大幅は720pxとしてください。

表示上の制約
各要素を個別のカードで囲まない
ページ全体を大きなカードにしない
グラデーションを使わない
ガラス調表現を使わない
背景へ模様や装飾図形を置かない
大型のヒーロー見出しを作らない
アイコンは原則として使わない
絵文字を使わない
紙吹雪を使わない
強いドロップシャドウを使わない
角丸は8px前後に統一する
アクセント色は1色に抑える
成績を複数の大型カードへ分割しない
操作上の制約
回答はEnterで送信するため、回答欄の隣に送信ボタンを置かない
回答後は入力欄へフォーカスを戻す
フィードバック表示によってレイアウトを上下させない
正解・不正解は色に加えてテキストでも示す
キーボード操作を最優先する
実装手順

最初に以下を作成してください。

白黒中心のワイヤーフレーム
Vueコンポーネント構造
デザイントークン
デスクトップ画面
320px幅のモバイル画面
ライト・ダークモード
Playwrightによるスクリーンショット

最初の実装では、装飾を追加するよりもレイアウトと操作性を完成させてください。

実装後、スクリーンショットを確認し、以下を自己レビューしてください。

AI生成UIにありがちなカード過多になっていないか
見出しが必要以上に大きくないか
余白が広すぎないか
ボタンが多すぎないか
ゲームの問題形状と回答欄が最も目立っているか

問題がある場合は、まず装飾要素を削除して修正してください。

「参考画像」を与えるのが一番効く

霊夢

文章だけで十分なの？

魔理沙

実際には、文章だけより参考画像を2〜4枚渡す方がかなり効く。

ただし「このサイトっぽく」だけではなく、それぞれ何を参考にするか明示する。

参考画像A:
余白、文字サイズ、フォームの密度を参考にする。
配色は参考にしない。

参考画像B:
ゲーム画面の情報順序だけ参考にする。
カード表現とアイコンは採用しない。

参考画像C:
結果一覧の行間と罫線を参考にする。
ナビゲーションは採用しない。

参考元としては、派手なゲームより次のようなUIが向いている。

GitHubの設定画面
MDNのデモページ
GOV.UK系のフォーム
Wikipediaのツール的な画面
シンプルな辞書・クイズサイト
OS標準設定画面

ただし丸ごと模倣させず、どの属性を借りるか限定するのが大事だぜ。

Skill以外に用意するとよいもの

SKILL.md だけでなく、次の4つをセットにすると安定する。

docs/design/
├── principles.md
├── tokens.css
├── screen-specs.md
├── references/
└── anti-patterns.md

特に効果があるのが anti-patterns.md だ。

# 採用しないUI例

- すべての情報を角丸カードへ分割する
- 紫から青へのグラデーション
- 大きな「Welcome」見出し
- 大型アイコン付きモード選択カード
- スコアを4枚のKPIカードで表示
- ボタンをピル型で統一
- 各見出しの横へ装飾アイコンを付ける
- 画面下へ固定ナビゲーションを置く
エージェントにスクリーンショットで反復させる

最も重要なのは、コードを書かせて終わりにしないことだぜ。

指示は次の循環にする。

実装
↓
Playwrightで1280×800と390×844を撮影
↓
Plain UI Skillのチェックリストで自己評価
↓
不要な装飾を削る
↓
再撮影

「もっときれいにして」ではなく、次のように修正させる。

現在の画面はカード境界が多すぎる。
市区町村名、形状、入力欄を1つの連続したレイアウトに変更する。
スコアカードを廃止し、ヘッダー下の1行表示にする。
タイトルを32pxから20pxへ下げる。
背景のグラデーションとシャドウを削除する。
UIライブラリはどうするか

このゲームなら、最初から大規模なUIライブラリを入れない方がよい。

推奨は次のどちらかだ。

Vue＋通常のCSS
Vue＋Tailwind CSS。ただしSkillで使用クラスを厳しく制約

shadcn系のコンポーネントを使う場合、エージェントは何でも Card に入れがちなので注意が必要だ。

Headless UI、Radix系、Reka UIのような振る舞いだけ提供するものを必要箇所に限定して使い、見た目は自前で薄く付ける方が今回には合う。

霊夢

要するに「こざっぱり」を説明するより、カード、影、巨大文字、グラデーションを明示的に禁止した方がいいのね。

魔理沙

その通りだぜ。さらに、

初稿は装飾不足でよい。装飾を足す前に、情報構造と操作性を完成させること。

と書いておくと、かなり暴走しにくくなる。

このゲームの場合は、地図形状と入力欄以外を目立たせないという一本の判断基準を、すべての画面に適用するのが一番分かりやすい。

Workersのプロジェクトを一から構築するにはどうやればいい？
(最初にコーディングエージェント用の指示を書き、最後に人間が最低限やるべきことを書いて)
14s考えました

霊夢

最初にエージェントへ渡す指示を書いて、そのあとに構築方針、最後に人間がやる作業をまとめてほしいのね。

魔理沙

今回のゲームなら、Cloudflare公式のVueテンプレートを土台にして、Worker側をHonoへ置き換えるのが一番素直だぜ。

現在のCloudflare公式Vueテンプレートは、Vue SPA、Worker API、Workers Static Assets、Cloudflare Vite Pluginが最初から統合されている。静的ファイルに一致しないSPAルートをVueへ戻す設定も生成される。

1. 最初にコーディングエージェントへ渡す指示
Cloudflare Workersプロジェクト初期構築指示

日本全国の市区町村タイピングゲームを実装するため、Cloudflare Workers上で動作するVue 3＋Honoプロジェクトを新規構築してください。

今回はゲーム本体の実装ではなく、今後安全に機能追加できるプロジェクト基盤の構築を目的とします。

1. 技術構成

以下を使用してください。

TypeScript
Vue 3
Vite
Cloudflare Vite Plugin
Cloudflare Workers
Workers Static Assets
Hono
pnpm
Vitest
@cloudflare/vitest-pool-workers
Playwright
ESLint
Prettier

パッケージは、作業時点の安定版を使用してください。

Cloudflare PagesやWorkers Sitesではなく、Cloudflare Workers＋Workers Static Assetsを使用してください。

2. プロジェクト生成

Cloudflare公式のVueテンプレートを使用して開始してください。

pnpm create cloudflare@latest municipality-typing-game --framework=vue

対話形式で質問された場合は、次を選択してください。

TypeScriptを使用する
Gitを初期化する
その場ではデプロイしない

生成後、既存のWorkerエントリーポイントをHonoアプリケーションへ置き換えてください。

3. 基本構成

最終的な構成を、おおむね次の形にしてください。

municipality-typing-game/
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── architecture.md
│   ├── development.md
│   └── decisions/
├── e2e/
│   └── smoke.spec.ts
├── public/
├── scripts/
├── src/
│   ├── app/
│   │   ├── App.vue
│   │   ├── router/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── pages/
│   │   ├── styles/
│   │   └── main.ts
│   └── shared/
│       ├── schemas/
│       ├── types/
│       └── constants/
├── worker/
│   ├── app.ts
│   ├── index.ts
│   ├── middleware/
│   ├── routes/
│   │   ├── health.ts
│   │   └── game-sessions.ts
│   └── services/
├── tests/
├── env.d.ts
├── eslint.config.js
├── index.html
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── wrangler.jsonc

テンプレートの制約で多少異なる場合は、Cloudflare Vite Pluginの標準構成を優先してください。

4. Worker API

Honoを使用してください。

Workerエントリーポイントは、できるだけ薄くしてください。

// worker/index.ts
import app from "./app"

export default app
// worker/app.ts
import { Hono } from "hono"
import { healthRoute } from "./routes/health"

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.route("/api/health", healthRoute)

app.notFound((c) => {
  return c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "The requested API endpoint was not found.",
      },
    },
    404,
  )
})

app.onError((error, c) => {
  console.error(error)

  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    },
    500,
  )
})

export default app

ヘルスチェックAPIを実装してください。

GET /api/health

レスポンス例：

{
  "status": "ok",
  "service": "municipality-typing-game",
  "timestamp": "2026-07-22T00:00:00.000Z"
}

APIレスポンスはJSONに統一してください。

5. APIとSPAのルーティング

次のルーティングを成立させてください。

/api/*
  WorkerのHono APIで処理

/assets/*、faviconなど
  Workers Static Assetsから配信

それ以外
  Vue SPAとして配信

wrangler.jsonc のAssets設定では、SPAのHistory API fallbackが動作するようにしてください。

APIに存在しないパスへアクセスした場合、SPAのHTMLを返さずJSON 404を返してください。

次を必ずテストしてください。

GET /                  → VueのHTML
GET /play              → VueのHTML
GET /api/health        → JSON 200
GET /api/not-found     → JSON 404
GET /存在しない画面    → VueのHTML
6. Wrangler設定

wrangler.jsonc を使用してください。

最低限、次を設定してください。

{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "municipality-typing-game",
  "main": "./worker/index.ts",
  "compatibility_date": "<作業日のUTC日付>",
  "assets": {
    "not_found_handling": "single-page-application"
  }
}

Cloudflare Vite Pluginが生成するAssets出力設定と衝突しないようにしてください。

compatibility_date は推測せず、作業日のUTC日付を設定してください。

不要な nodejs_compat は有効化しないでください。Web標準APIだけで実装できない依存関係が発生した場合に限り、理由をADRへ記録したうえで追加してください。

7. Bindings型生成

Bindings型を手書きだけで管理しないでください。

次のスクリプトを用意してください。

{
  "scripts": {
    "cf-typegen": "wrangler types --env-interface CloudflareBindings"
  }
}

wrangler.jsonc の変更後に、型を再生成できるようにしてください。

生成された型がTypeScriptから認識されることを確認してください。

Honoでは次のように利用してください。

const app = new Hono<{ Bindings: CloudflareBindings }>()
8. Vue側

Vue Routerを導入し、最低限次の画面を作ってください。

/
  開発中のトップ画面

/play
  開発中のゲーム画面

/about
  開発中の説明画面

UIは装飾を最小限にしてください。

グラデーションを使わない
カードを乱用しない
強いシャドウを使わない
システムフォントを使用する
最大コンテンツ幅は720px
キーボード操作が可能
ライトモードとダークモードに対応
320px幅で横スクロールしない

トップ画面から /api/health を呼び出し、Worker APIへ接続できていることを控えめに表示してください。

9. APIクライアント

Vueコンポーネント内に直接 fetch() を散在させないでください。

次のような共通APIクライアントを作ってください。

interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}

class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

実装する関数：

getHealth(): Promise<HealthResponse>

次を処理してください。

HTTPエラー
JSON解析失敗
ネットワークエラー
AbortSignal
レスポンスのスキーマ検証
10. 環境変数とSecrets

秘密情報をGitへコミットしないでください。

次を追加してください。

.dev.vars.example

実際の .dev.vars は .gitignore に含めてください。

初期段階では秘密情報を必要としない構成にしてください。

公開してよい設定と秘密情報を明確に分離してください。

Vueへ埋め込む公開値：VITE_*
Workerの通常変数：wrangler.jsonc の vars
秘密情報：Wrangler Secret
ローカル秘密情報：.dev.vars
11. package.json

最低限、次のスクリプトを用意してください。

{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "pnpm build && vite preview",
    "deploy": "pnpm build && wrangler deploy",
    "cf-typegen": "wrangler types --env-interface CloudflareBindings",
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}

テンプレート側のスクリプト名と衝突する場合は整理してください。

pnpm check がCIとローカルの共通検証コマンドになるようにしてください。

12. テスト
Worker単体テスト

@cloudflare/vitest-pool-workers を使用し、実際のWorkersランタイムに近い環境でテストしてください。

最低限：

/api/health が200を返す
Content-TypeがJSON
必須フィールドが存在する
未知のAPIパスがJSON 404を返す
例外がJSON 500へ変換される
Vue単体テスト

最低限：

Appが描画できる
API接続状態を表示できる
API失敗時にエラー表示できる
E2Eテスト

Playwrightで最低限：

/ が開く
/play を直接開ける
/about を直接開ける
ブラウザから /api/health を取得できる
320px幅で横スクロールしない
13. CI

GitHub Actionsで、Pull Requestとmainへのpush時に次を実行してください。

pnpm install --frozen-lockfile
pnpm cf-typegen
pnpm check
pnpm test:e2e

CIではデプロイしないでください。

初期PRでは、Cloudflare API Tokenを必要としない構成にしてください。

依存関係のキャッシュを設定してください。

14. Git管理

次をコミットしないでください。

.dev.vars
.env.local
Cloudflare API Token
Account IDを含む個人用設定
ビルド成果物
Playwrightの一時成果物

次はコミットしてください。

pnpm-lock.yaml
.dev.vars.example
Wrangler設定
Bindings型生成手順
CI設定
ドキュメント
15. ドキュメント

README.md に次を記載してください。

必要なNode.jsとpnpm
インストール
開発サーバー起動
型生成
テスト
ビルド
ローカルプレビュー
Cloudflareへのログイン
手動デプロイ
環境変数とSecretsの設定方法
ディレクトリ構成
APIとSPAのルーティング規則

docs/architecture.md には次を記載してください。

VueとWorkerの責務
Static Assetsの配信経路
APIルーティング
将来の市区町村形状データ配信方法
将来のD1・R2導入方針
16. 将来の拡張に備える事項

現時点ではD1、R2、KV、Durable Objectsを作成しないでください。

ただし、将来次を追加できる構造にしてください。

D1：ランキングや共有結果
R2：大きな地理データの原本または生成物
Workers Static Assets：ゲーム用に最適化したSVG・JSON
Analytics Engine：匿名の利用統計
Durable Objects：強いセッション整合性が必要になった場合

問題形状の静的データは、原則としてWorkers Static Assetsへ置く予定です。

出題APIは形状本体を毎回JSONへ埋め込まず、形状IDまたはアセットURLを返す設計にしてください。

17. 禁止事項
Cloudflare Pagesを使用しない
Workers Sitesを使用しない
ExpressやNode.js専用APIへ依存しない
不要なNode.js互換モードを有効化しない
全APIを1ファイルへ書かない
Vueコンポーネント内へ直接API処理を散在させない
シークレットをソースコードへ記述しない
初期構築時点でD1やR2を勝手に作成しない
エラーを握り潰さない
any を使用しない
未検証のAPIレスポンスを型アサーションだけで処理しない
実行していないコマンドを成功したと報告しない
18. 完了条件

以下がすべて成立したら完了です。

pnpm install
pnpm cf-typegen
pnpm dev
pnpm check
pnpm test:e2e
pnpm preview

さらに、次を実際に確認してください。

Vueのトップ画面を表示できる
/play を直接開いても404にならない
/api/health がJSONを返す
存在しないAPIがJSON 404を返す
本番ビルドをWorkersランタイムでプレビューできる
Gitに秘密情報が含まれていない
19. 作業終了時の報告

最後に次を報告してください。

作成・変更したファイル
採用したパッケージとバージョン
実行したコマンド
テスト結果
ビルド結果
未解決事項
人間による操作が必要な事項
次のPRで実装すべき内容

コマンドの成功を推測せず、実際の終了コードを確認してください。

2. 実際の構築方針

霊夢

公式のVueテンプレートと、Honoのテンプレートはどっちを起点にするの？

魔理沙

今回については、CloudflareのVueテンプレートを起点にする方を推すぜ。

pnpm create cloudflare@latest municipality-typing-game --framework=vue

Cloudflare公式ガイドでは、このテンプレートから概ね次の構成が生成される。

src/
  App.vue
  server/
    index.ts
index.html
vite.config.ts
wrangler.jsonc

WorkerはバックエンドAPIとなり、Vueからfetch()で呼び出せる。SPA向けのnot_found_handlingも設定される。

HonoにもCloudflare Workers＋Vite用テンプレートはあるが、公式例はHono JSXを中心としたフルスタック構成だ。Vueを使う今回では、VueテンプレートへHonoのルーターだけ導入した方が変更点が少ない。Hono自体は、Workerのデフォルトエクスポートとしてそのまま使用できる。

初期生成後の主要コマンド
cd municipality-typing-game

pnpm add hono
pnpm add -D \
  vue-router \
  vue-tsc \
  vitest \
  @cloudflare/vitest-pool-workers \
  @vue/test-utils \
  playwright \
  eslint \
  prettier

ただし、テンプレートに既に含まれるパッケージを重複追加しないよう、エージェントには先にpackage.jsonを確認させる。

WorkerをHono化する最小例
// worker/app.ts
import { Hono } from "hono"

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    service: "municipality-typing-game",
    timestamp: new Date().toISOString(),
  })
})

app.notFound((c) => {
  return c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "The requested API endpoint was not found.",
      },
    },
    404,
  )
})

export default app
// worker/index.ts
import app from "./app"

export default app

HonoはBindings型をジェネリックで受け取れる。Wrangler設定からwrangler types --env-interface CloudflareBindingsで型を生成する方法も公式に案内されている。

wrangler.jsonc の考え方
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "municipality-typing-game",
  "main": "./worker/index.ts",
  "compatibility_date": "2026-07-22",
  "assets": {
    "not_found_handling": "single-page-application"
  }
}

Cloudflare Vite Pluginは通常、ルートにあるwrangler.jsonc、wrangler.json、wrangler.tomlを自動的に読み込む。設定をViteファイルへ埋め込むより、Wrangler設定ファイルに置く方が、型生成やD1/R2などのCLI操作と整合しやすい。

vite.config.ts

生成された設定を基本的に維持する。

概念的には次の形になる。

import vue from "@vitejs/plugin-vue"
import { cloudflare } from "@cloudflare/vite-plugin"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [vue(), cloudflare()],
})

Cloudflare Vite Pluginを使うと、Workerコードがローカルでもworkerd上で動き、BindingsやWorkers固有APIを本番に近い環境で利用できる。vite previewもビルド成果物をWorkersランタイムで確認する。

3. D1やR2は最初から作るべきか

霊夢

ゲームなら、最初からD1やR2も用意しておいた方がよくない？

魔理沙

最初は作らない方がいいぜ。

このゲームの初期構築に必要なのは、

Vue SPA
Workers API
Static Assets
テスト
CI

だけだ。

市区町村形状は、ゲーム向けに簡略化したSVGパスやJSONなら、まずWorkers Static Assetsで十分だ。Workers Static AssetsはフロントエンドとWorker APIを同一アプリとして配信でき、Vueテンプレートもこの構成を前提にしている。

リソースは用途が確定してから追加する。

リソース	追加する条件
D1	ランキング、共有結果、永続セッションが必要
R2	原寸に近い地理データなど、静的Assetsへ置きにくい大容量データが必要
KV	小さな設定やキャッシュを頻繁に読む必要がある
Durable Objects	セッションの厳密な直列化やリアルタイム競技が必要
Analytics Engine	匿名利用統計を収集する
4. 初期PRの分け方

最初からゲームを実装させず、次のように分割した方がレビューしやすい。

PR 1
Cloudflare Workers＋Vue＋Honoの基盤

PR 2
UI基盤、ルーティング、Plain UI Skill

PR 3
ゲームコアとローマ字正規化

PR 4
群馬県だけの形状データ試作

PR 5
出題セッションAPI

PR 6
全国データETL

初期PRでは/api/healthとVueの仮画面だけに留める。D1、R2、認証、ランキングを同時に入れないことが重要だぜ。

5. 人間が最低限やるべきこと

霊夢

最後に、エージェントへ全部任せても、人間が避けられない作業は何？

魔理沙

最低限、次だけは人間が担当する必要がある。

5.1 Cloudflareアカウントへログイン

ローカル端末で実行する。

pnpm wrangler login

ブラウザが開いたら、利用するCloudflareアカウントを選択して認可する。

Cloudflareアカウントそのものは人間が作成・選択する必要がある。C3やWranglerがプロジェクト作成とデプロイを担当する。

5.2 Worker名を確認する

wrangler.jsonc の次を確認する。

{
  "name": "municipality-typing-game"
}

この名前はCloudflareアカウント内で使われるため、既存Workerと衝突しないものを決める。

5.3 初回デプロイを承認する

エージェントの検証結果を見たあと、人間が実行する。

pnpm deploy

生成されたworkers.devのURLへアクセスし、次を確認する。

/
  Vue画面が表示される

/play
  直接アクセスしても表示される

/api/health
  JSONが返る

/api/not-found
  JSON 404が返る
5.4 GitHubリポジトリの作成とpush

秘密情報が含まれていないことを確認してから、リモートへpushする。

git status
git diff --cached
git remote add origin <リポジトリ>
git push -u origin main

特に確認するファイル：

.dev.vars
.env*
wrangler.jsonc
GitHub Actions
生成された型定義

.dev.varsやAPI Tokenがコミットされていた場合は、履歴から削除し、漏れたSecretを失効させる。

5.5 本番用Secretの登録

将来Secretが必要になった時だけ、人間が登録する。

pnpm wrangler secret put SESSION_SIGNING_KEY

値をソースコード、.env.example、エージェントへのプロンプトへ直接貼らない。

5.6 最終的な目視確認

最低限、次を人間の目で確認する。

UIが過剰に装飾されていない
スマートフォン幅で崩れない
キーボード操作ができる
APIエラー時に無限ロードしない
workers.dev上でもSPAの直接アクセスが動く
出典や規約に関する未確定表示が本番公開されていない

それ以外のファイル作成、依存関係導入、テスト、型生成、CI作成は、基本的にコーディングエージェントへ任せてよい。

## その他！
- API定義は oRPC の コントラクトファーストにする  
  * https://github.com/misskey-dev/misskey/discussions/17609 の私の発言を読んで
- 思想として、右から左に横に流れるようなアニメーションを使いたい
