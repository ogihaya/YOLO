# YOLO Web Application

YOLO 物体検出のアノテーションから推論までを一貫して扱う Django + Docker ベースの開発環境です。`yolov9/` ディレクトリには既存の YOLOv9 実装が含まれており、今後アプリケーションと統合していきます。

## Requirements

- Docker Desktop 4.x 以上
- docker compose v2

Python や Node.js を事前にインストールする必要はありません（Docker が開発環境を提供します）。

## Setup

1. (任意) `.env.example` をコピーして開発用の環境変数を調整します。
   ```bash
   cp .env.example .env.development
   ```
2. Docker イメージをビルドしてコンテナを起動します。
   ```bash
   docker compose up --build
   ```
3. ブラウザで <http://localhost:8000/api/health/> を開き、`{"status":"ok"}` が表示されることを確認します。

## Useful Commands

プロジェクトルートで以下を実行します。

```bash
# マイグレーション
docker compose run --rm web python manage.py migrate

# Django シェル
docker compose run --rm web python manage.py shell

# テスト
docker compose run --rm web python manage.py test
```

## Annotation Workspaces (Phase 2 & 3)

1. **Train (Phase 2)**  
   <http://localhost:8000/api/train/> を開くと train データセット用のワークスペースが表示されます。  
   クラスを追加 → 画像上でドラッグして矩形を描く → 「完了」で `train.zip` をダウンロードできます。

2. **Val (Phase 3)**  
   <http://localhost:8000/api/val/> にアクセスすると val データセット用のワークスペースになります。  
   操作フローは train と同じで、エクスポート時には `val/images`・`val/labels` を含む `val.zip` がダウンロードされます。

## Inference Screen (Phase 3)

- コンテナ起動後、ブラウザで <http://localhost:8000/api/inference/> を開きます。
- `.pt` モデルを 1 つ選択し、推論対象の画像を複数ドラッグ＆ドロップして「推論開始」を押すと、ブラウザ上で結果が表示されます。
- 検出結果はバウンディングボックスとクラス名/スコアで可視化され、各画像ごとに「結果画像を保存」で描画済み PNG をダウンロードできます。
- バックエンドは `yolov9/bridge.py` を介して YOLOv9 資産と統合されており、`backend/annotation/services/yolov9_adapter.py` が Django からのアップロードをブリッジしています（現状は deterministic なダミー推論を返し、将来的に本物の YOLO パイプラインへ差し替え可能です）。

## YOLOv9 Assets (Phase 4)

- `yolov9/` ディレクトリから不要な `dataset/` と `tests/` を除外し、`yolov9/README.md` に整理内容と再取得方法を記載しています。
- `yolov9/bridge.py` がアプリケーションと YOLO 実装を結ぶ統合ポイントです。将来的に PyTorch + YOLOv9 推論を組み込みたい場合はこのモジュールの実装を置き換えるだけで済みます。

## Repository Structure

```
backend/        # Django プロジェクトとアプリ (yoloapp + annotation)
yolov9/         # 既存の YOLOv9 実装 (後で整理/統合予定)
docker-compose.yml
Dockerfile
Requirement.md  # 詳細仕様
```

## Next Steps

- 画面1/2のアノテーション UI 実装
- 推論画面の API/フロント開発
- `yolov9/` の整理と Django との統合
