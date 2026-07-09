import unittest
from pathlib import Path

import predict


class PredictPathTests(unittest.TestCase):
    def test_model_and_upload_paths_are_resolved(self):
        self.assertTrue(Path(predict.MODEL_PATH).exists())
        self.assertTrue(Path(predict.UPLOAD_FOLDER).exists())
        self.assertEqual(Path(predict.resolve_path("uploads")), Path("uploads"))
        self.assertEqual(Path(predict.resolve_path(Path(predict.UPLOAD_FOLDER) / "sample.jpg")), Path(predict.UPLOAD_FOLDER) / "sample.jpg")


if __name__ == "__main__":
    unittest.main()
