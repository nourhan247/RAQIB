using RAQIB.Core.DTOs;

namespace RAQIB.Core.Interfaces;

public interface IReportPdfService
{
    Task<byte[]> GeneratePdfReportAsync(PdfReportRequestDto request);
}