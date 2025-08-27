import React, { useState, useCallback } from 'react';
import heic2any from 'heic2any';
import JSZip from 'jszip';

function App() {
  const [heicFiles, setHeicFiles] = useState([]);
  const [convertedImages, setConvertedImages] = useState([]);
  const [outputFormat, setOutputFormat] = useState('jpeg');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const MAX_FILE_SIZE_MB = 25;

  const handleFileChange = useCallback((acceptedFiles) => {
    setError(null);
    const newFiles = acceptedFiles.filter(file => {
      if (file.type !== 'image/heic' && file.type !== 'image/heif') {
        setError(`Unsupported file type: ${file.name}. Only HEIC/HEIF files are allowed.`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`File ${file.name} is too large. Max file size is ${MAX_FILE_SIZE_MB}MB.`);
        return false;
      }
      return true;
    });
    setHeicFiles(prevFiles => [...prevFiles, ...newFiles]);
  }, []);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const files = Array.from(event.dataTransfer.files);
    handleFileChange(files);
  }, [handleFileChange]);

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const convertImages = async () => {
    setLoading(true);
    setError(null);
    setConvertedImages([]);

    const newConvertedImages = [];
    for (const file of heicFiles) {
      try {
        const convertedBlob = await heic2any({
          blob: file,
          toType: `image/${outputFormat}`,
          quality: 0.9
        });

        const url = URL.createObjectURL(convertedBlob);
        newConvertedImages.push({
          id: `${file.name}-${Date.now()}`,
          name: file.name.replace(/\.heic$/, `.${outputFormat}`),
          url: url,
          blob: convertedBlob,
          originalFile: file
        });
      } catch (err) {
        console.error(`Error converting ${file.name}:`, err);
        setError(`Failed to convert ${file.name}. Please try again.`);
      }
    }
    setConvertedImages(newConvertedImages);
    setLoading(false);
  };

  const downloadImage = (image) => {
    const link = document.createElement('a');
    link.href = image.url;
    link.download = image.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAllImages = async () => {
    if (convertedImages.length === 0) return;

    setLoading(true);
    const zip = new JSZip();
    convertedImages.forEach(image => {
      zip.file(image.name, image.blob);
    });

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'converted-images.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error creating zip file:', err);
      setError('Failed to create zip file for download.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10 px-4">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">HEIC to JPG/PNG Converter</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      <div
        className="w-full max-w-2xl border-2 border-dashed border-gray-300 rounded-lg p-10 text-center cursor-pointer hover:border-gray-400 transition-colors"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => document.getElementById('fileInput').click()}
      >
        <input
          type="file"
          id="fileInput"
          multiple
          accept=".heic,.heif"
          onChange={(e) => handleFileChange(Array.from(e.target.files))}
          className="hidden"
        />
        <p className="text-lg text-gray-600 mb-2">Drag & Drop HEIC files here, or click to select</p>
        <p className="text-sm text-gray-500">Max file size: {MAX_FILE_SIZE_MB}MB per file</p>
        {heicFiles.length > 0 && (
          <div className="mt-4 text-sm text-gray-700">
            Selected files: {heicFiles.map(file => file.name).join(', ')}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-4 mt-6">
        <label htmlFor="outputFormat" className="text-gray-700">Output Format:</label>
        <select
          id="outputFormat"
          value={outputFormat}
          onChange={(e) => setOutputFormat(e.target.value)}
          className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="jpeg">JPG</option>
          <option value="png">PNG</option>
        </select>
        <button
          onClick={convertImages}
          disabled={heicFiles.length === 0 || loading}
          className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Converting...' : 'Convert'}
        </button>
      </div>

      {loading && (
        <div className="mt-8 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="ml-3 text-gray-600">Processing images...</p>
        </div>
      )}

      {convertedImages.length > 0 && (
        <div className="mt-10 w-full max-w-4xl">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Converted Images</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {convertedImages.map((image) => (
              <div key={image.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <img src={image.url} alt={image.name} className="w-full h-48 object-cover" />
                <div className="p-4">
                  <p className="text-sm font-medium text-gray-700 truncate">{image.name}</p>
                  <button
                    onClick={() => downloadImage(image)}
                    className="mt-3 w-full px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <button
              onClick={downloadAllImages}
              disabled={convertedImages.length === 0 || loading}
              className="px-8 py-3 bg-purple-600 text-white font-semibold rounded-md shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Download All as ZIP
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
