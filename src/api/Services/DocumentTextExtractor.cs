using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace UniAi.Api.Services;

public sealed record ExtractedDocument(string FileName, string Text, int CharacterCount);

public sealed class DocumentTextExtractor
{
    public const long MaxFileBytes = 20L * 1024 * 1024;
    private const int MaxExtractedCharacters = 120_000;
    private const long MaxExpandedArchiveBytes = 50L * 1024 * 1024;
    private const int MaxArchiveEntries = 2_000;

    public async Task<ExtractedDocument> ExtractAsync(IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length is <= 0 or > MaxFileBytes)
        {
            throw new InvalidDataException("Each document must be between 1 byte and 20 MB.");
        }

        var safeFileName = Path.GetFileName(file.FileName);
        var extension = Path.GetExtension(safeFileName).ToLowerInvariant();

        string text;
        await using var stream = file.OpenReadStream();
        try
        {
            text = extension switch
            {
                ".pdf" => ExtractPdf(stream),
                ".pptx" => ExtractPowerPoint(stream),
                ".docx" => ExtractWord(stream),
                ".txt" => await ExtractPlainTextAsync(stream, cancellationToken),
                _ => throw new InvalidDataException("Supported formats are PDF, PPTX, DOCX, and TXT.")
            };
        }
        catch (InvalidDataException)
        {
            throw;
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new InvalidDataException($"Could not read {safeFileName}. Check that it is a valid, text-readable file.");
        }

        text = NormalizeText(text);
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new InvalidDataException($"No readable text was found in {safeFileName}. Scanned image-only PDFs are not supported yet.");
        }

        if (text.Length > MaxExtractedCharacters)
        {
            throw new InvalidDataException($"{safeFileName} contains too much text for this first study flow. Try a shorter document or split it into sections.");
        }

        return new ExtractedDocument(safeFileName, text, text.Length);
    }

    private static string ExtractPdf(Stream stream)
    {
        using var pdf = PdfDocument.Open(stream);
        if (pdf.NumberOfPages > 200)
        {
            throw new InvalidDataException("PDFs are limited to 200 pages in this preview.");
        }

        var pages = new List<string>(pdf.NumberOfPages);
        foreach (var page in pdf.GetPages())
        {
            var pageText = ContentOrderTextExtractor.GetText(page);
            if (!string.IsNullOrWhiteSpace(pageText))
            {
                pages.Add($"[Page {page.Number}]\n{pageText}");
            }
        }

        return string.Join("\n\n", pages);
    }

    private static string ExtractPowerPoint(Stream stream)
    {
        using var archive = OpenSafeArchive(stream);
        var slides = archive.Entries
            .Select(entry => new { Entry = entry, Match = Regex.Match(entry.FullName, @"^ppt/slides/slide(\d+)\.xml$", RegexOptions.IgnoreCase) })
            .Where(item => item.Match.Success)
            .OrderBy(item => int.Parse(item.Match.Groups[1].Value, System.Globalization.CultureInfo.InvariantCulture))
            .ToArray();

        if (slides.Length == 0)
        {
            throw new InvalidDataException("No presentation slides were found in this PPTX file.");
        }

        var output = new List<string>(slides.Length);
        foreach (var (slide, index) in slides.Select((item, index) => (item.Entry, index)))
        {
            var xml = LoadSafeXml(slide);
            var paragraphs = xml.Descendants()
                .Where(element => element.Name.LocalName == "p")
                .Select(paragraph => string.Concat(paragraph.Descendants()
                    .Where(element => element.Name.LocalName == "t")
                    .Select(element => element.Value)))
                .Where(text => !string.IsNullOrWhiteSpace(text));
            output.Add($"[Slide {index + 1}]\n{string.Join("\n", paragraphs)}");
        }

        return string.Join("\n\n", output);
    }

    private static string ExtractWord(Stream stream)
    {
        using var archive = OpenSafeArchive(stream);
        var documentEntry = archive.GetEntry("word/document.xml")
            ?? throw new InvalidDataException("No readable Word document content was found in this DOCX file.");
        var xml = LoadSafeXml(documentEntry);
        var paragraphs = xml.Descendants()
            .Where(element => element.Name.LocalName == "p")
            .Select(paragraph => string.Concat(paragraph.Descendants()
                .Where(element => element.Name.LocalName == "t")
                .Select(element => element.Value)))
            .Where(text => !string.IsNullOrWhiteSpace(text));

        return string.Join("\n", paragraphs);
    }

    private static ZipArchive OpenSafeArchive(Stream stream)
    {
        var archive = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
        if (archive.Entries.Count > MaxArchiveEntries || archive.Entries.Sum(entry => entry.Length) > MaxExpandedArchiveBytes)
        {
            archive.Dispose();
            throw new InvalidDataException("The document has an unsafe or unsupported archive structure.");
        }

        return archive;
    }

    private static XDocument LoadSafeXml(ZipArchiveEntry entry)
    {
        if (entry.Length > 20L * 1024 * 1024)
        {
            throw new InvalidDataException("The document contains an oversized XML section.");
        }

        var settings = new XmlReaderSettings
        {
            DtdProcessing = DtdProcessing.Prohibit,
            XmlResolver = null,
            MaxCharactersInDocument = 20_000_000,
            IgnoreComments = true
        };
        using var stream = entry.Open();
        using var reader = XmlReader.Create(stream, settings);
        return XDocument.Load(reader, LoadOptions.None);
    }

    private static async Task<string> ExtractPlainTextAsync(Stream stream, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(stream, new UTF8Encoding(false, true), detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var content = await reader.ReadToEndAsync(cancellationToken);
        if (content.Length > MaxExtractedCharacters)
        {
            throw new InvalidDataException("Text files are limited to 120,000 characters in this preview.");
        }

        return content;
    }

    private static string NormalizeText(string text) =>
        Regex.Replace(text.Replace('\0', ' '), @"[\t\f\v ]+", " ").Trim();
}
