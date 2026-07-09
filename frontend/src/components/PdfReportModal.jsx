import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import { api } from "../services/api";

const C = { orange: "#F28C28", orangeDark: "#E57200", gray: "#C8CDD6" };

export default function PdfReportModal({ open, onClose, governorateOptions = [] }) {
  const [governorate, setGovernorate] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.downloadReportsPdf({
        governorate: governorate || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      onClose();
    } catch (e) {
      setError(e.message || "تعذر توليد التقرير، حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { background: "#0d1f35", color: "#fff", borderRadius: 3, border: "1px solid rgba(200,205,214,0.15)" } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PictureAsPdfRoundedIcon sx={{ color: C.orange }} />
        تحميل تقرير PDF للتحليلات
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: C.gray, mb: 2 }}>
          اختر نطاق البيانات المطلوب، وسيتم توليد تقرير احترافي يشمل الإحصائيات والرسوم البيانية والتوصيات.
        </Typography>

        <Stack spacing={2} dir="rtl">
          <FormControl size="small" fullWidth>
            <InputLabel id="pdf-gov-select" sx={{ color: C.gray }}>المحافظة</InputLabel>
            <Select
              labelId="pdf-gov-select"
              value={governorate}
              label="المحافظة"
              onChange={(e) => setGovernorate(e.target.value)}
              sx={{ color: "#fff" }}
            >
              <MenuItem value="">كل المحافظات</MenuItem>
              {governorateOptions.map((gov) => (
                <MenuItem key={gov} value={gov}>{gov}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small" type="date" label="من تاريخ" value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true, sx: { color: C.gray } }}
            sx={{ input: { color: "#fff" } }}
          />
          <TextField
            size="small" type="date" label="إلى تاريخ" value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true, sx: { color: C.gray } }}
            sx={{ input: { color: "#fff" } }}
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} sx={{ color: C.gray }}>إلغاء</Button>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} sx={{ color: "#1a1103" }} /> : <PictureAsPdfRoundedIcon />}
          sx={{
            background: `linear-gradient(135deg, ${C.orange}, ${C.orangeDark})`,
            color: "#1a1103",
            fontWeight: 700,
            "&:hover": { background: `linear-gradient(135deg, ${C.orangeDark}, ${C.orange})` },
          }}
        >
          {loading ? "جارٍ التوليد..." : "توليد وتحميل التقرير"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
