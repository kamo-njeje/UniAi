using System.IO.Compression;
using System.Text;
using Microsoft.AspNetCore.Http;
using UniAi.Api.Services;

public class DocumentTextExtractorTests
{
    private readonly DocumentTextExtractor extractor = new();

    private static IFormFile File(string name, byte[] bytes) =>
        new FormFile(new MemoryStream(bytes), 0, bytes.Length, "files", name);

    private static IFormFile TextFile(string name, string content) =>
        File(name, Encoding.UTF8.GetBytes(content));

    private static byte[] Zip(params (string Path, string Content)[] entries)
    {
        using var output = new MemoryStream();
        using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (path, content) in entries)
            {
                var entry = archive.CreateEntry(path);
                using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
                writer.Write(content);
            }
        }
        return output.ToArray();
    }

    private const string WordNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private const string DrawingNs = "http://schemas.openxmlformats.org/drawingml/2006/main";

    private static string Slide(string text) =>
        $"<p:sld xmlns:p=\"urn:p\" xmlns:a=\"{DrawingNs}\"><a:p><a:r><a:t>{text}</a:t></a:r></a:p></p:sld>";

    [Fact]
    public async Task Txt_file_is_extracted()
    {
        var result = await extractor.ExtractAsync(TextFile("notes.txt", "Cells are the unit of life."), default);
        Assert.Equal("notes.txt", result.FileName);
        Assert.Contains("Cells are the unit of life.", result.Text);
    }

    [Fact]
    public async Task File_name_is_stripped_of_path_segments()
    {
        var result = await extractor.ExtractAsync(TextFile("../../evil.txt", "hello"), default);
        Assert.Equal("evil.txt", result.FileName);
    }

    [Fact]
    public async Task Unsupported_extension_is_rejected()
    {
        var ex = await Assert.ThrowsAsync<InvalidDataException>(() =>
            extractor.ExtractAsync(TextFile("program.exe", "MZ"), default));
        Assert.Contains("PDF, PPTX, DOCX, and TXT", ex.Message);
    }

    [Fact]
    public async Task Empty_file_is_rejected()
    {
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            extractor.ExtractAsync(File("empty.txt", []), default));
    }

    [Fact]
    public async Task Whitespace_only_text_is_rejected_as_unreadable()
    {
        var ex = await Assert.ThrowsAsync<InvalidDataException>(() =>
            extractor.ExtractAsync(TextFile("blank.txt", "   \n\t  "), default));
        Assert.Contains("No readable text", ex.Message);
    }

    [Fact]
    public async Task Text_over_the_character_limit_is_rejected()
    {
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            extractor.ExtractAsync(TextFile("big.txt", new string('a', 120_001)), default));
    }

    [Fact]
    public async Task Docx_paragraph_text_is_extracted()
    {
        var docx = Zip(("word/document.xml",
            $"<w:document xmlns:w=\"{WordNs}\"><w:body><w:p><w:r><w:t>Photosynthesis</w:t></w:r></w:p></w:body></w:document>"));
        var result = await extractor.ExtractAsync(File("lecture.docx", docx), default);
        Assert.Contains("Photosynthesis", result.Text);
    }

    [Fact]
    public async Task Docx_without_document_xml_is_rejected()
    {
        var docx = Zip(("other.xml", "<x/>"));
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            extractor.ExtractAsync(File("bad.docx", docx), default));
    }

    [Fact]
    public async Task Pptx_slides_are_ordered_numerically_and_labelled()
    {
        // Added out of order; slide10 must come after slide2 (numeric, not alphabetical).
        var pptx = Zip(
            ("ppt/slides/slide10.xml", Slide("tenth")),
            ("ppt/slides/slide2.xml", Slide("second")),
            ("ppt/slides/slide1.xml", Slide("first")));
        var result = await extractor.ExtractAsync(File("deck.pptx", pptx), default);

        var first = result.Text.IndexOf("first", StringComparison.Ordinal);
        var second = result.Text.IndexOf("second", StringComparison.Ordinal);
        var tenth = result.Text.IndexOf("tenth", StringComparison.Ordinal);
        Assert.True(first >= 0 && first < second && second < tenth);
        Assert.Contains("[Slide 1]", result.Text);
    }

    [Fact]
    public async Task Pptx_without_slides_is_rejected()
    {
        var pptx = Zip(("ppt/other.xml", "<x/>"));
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            extractor.ExtractAsync(File("empty.pptx", pptx), default));
    }

    [Fact]
    public async Task Xml_with_a_doctype_is_rejected()
    {
        var docx = Zip(("word/document.xml",
            $"<!DOCTYPE d [<!ENTITY x \"boom\">]><w:document xmlns:w=\"{WordNs}\"><w:body><w:p><w:r><w:t>&x;</w:t></w:r></w:p></w:body></w:document>"));
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            extractor.ExtractAsync(File("xxe.docx", docx), default));
    }

    [Fact]
    public async Task Archive_with_too_many_entries_is_rejected()
    {
        var entries = Enumerable.Range(0, 2_001).Select(i => ($"f{i}.txt", "x")).ToArray();
        var docx = Zip(entries);
        var ex = await Assert.ThrowsAsync<InvalidDataException>(() =>
            extractor.ExtractAsync(File("many.docx", docx), default));
        Assert.Contains("unsafe", ex.Message);
    }

    [Fact]
    public async Task Corrupt_docx_is_rejected()
    {
        await Assert.ThrowsAsync<InvalidDataException>(() =>
            extractor.ExtractAsync(File("corrupt.docx", Encoding.UTF8.GetBytes("this is not a zip")), default));
    }
}
