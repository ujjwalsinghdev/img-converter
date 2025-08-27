import React, { useState, useCallback, useEffect } from 'react';
import heic2any from 'heic2any';
import JSZip from 'jszip';
import './App.css'; // Import the new App.css

function App() {
  const [heicFiles, setHeicFiles] = useState([]);
  const [convertedImages, setConvertedImages] = useState([]);
  const [outputFormat, setOutputFormat] = useState('jpeg');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const MAX_FILE_SIZE_MB = 25;

  // Clean up object URLs when component unmounts or files are cleared
  useEffect(() => {
    return () => {
      heicFiles.forEach(item => URL.revokeObjectURL(item.thumbnail));
      convertedImages.forEach(image => URL.revokeObjectURL(image.url));
    };
  }, [heicFiles, convertedImages]);

  const handleFileChange = useCallback(async (acceptedFiles) => {
    setError(null);
    const newFiles = acceptedFiles.filter(file => {
      // console.log(`Processing file: ${file.name}, Type: ${file.type}`); // Removed diagnostic log
      if (!['image/heic', 'image/heif', 'image/x-heic', 'image/x-heif'].includes(file.type)) {
        setError(`Unsupported file type: ${file.name}. Only HEIC/HEIF files are allowed.`);
        return false;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`File ${file.name} is too large. Max file size is ${MAX_FILE_SIZE_MB}MB.`);
        return false;
      }
      return true;
    });
    const filesWithThumbnails = await Promise.all(newFiles.map(async file => {
      try {
        const thumbnailBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.2 // Lower quality for faster thumbnail generation
        });
        console.log(`Generated thumbnail URL for ${file.name} (type: ${file.type}): ${URL.createObjectURL(file)}`); // Original log, keep for debugging original file type
        console.log(`Generated *converted* thumbnail URL for ${file.name} (type: ${thumbnailBlob.type}): ${URL.createObjectURL(thumbnailBlob)}`);
        return {
          file,
          thumbnail: URL.createObjectURL(thumbnailBlob) // Use converted thumbnail
        };
      } catch (e) {
        console.error(`Failed to generate thumbnail for ${file.name}:`, e);
        return {
          file,
          thumbnail: null // Fallback if thumbnail generation fails
        };
      }
    }));
    setHeicFiles(prevFiles => [...prevFiles, ...filesWithThumbnails]);
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
    for (const item of heicFiles) { // Use item instead of file
      try {
        const convertedBlob = await heic2any({
          blob: item.file, // Access the actual file from the item object
          toType: `image/${outputFormat}`,
          quality: 0.9
        });
        console.log(`Converted ${item.file.name} to type: ${convertedBlob.type}`);

        const url = URL.createObjectURL(convertedBlob);
        newConvertedImages.push({
          id: `${item.file.name}-${Date.now()}`,
          name: item.file.name.replace(/\.(heic|heif)$/i, `.${outputFormat}`),
          url: url,
          blob: convertedBlob,
          originalFile: item.file
        });
      } catch (err) {
        console.error(`Error converting ${item.file.name}:`, err);
        setError(`Failed to convert ${item.file.name}. Please try again.`);
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
    <div className="app-container">
      <h1 className="app-title">HEIC to JPG/PNG Converter</h1>

      {error && (
        <div className="error-message" role="alert">
          <strong>Error!</strong>
          <span> {error}</span>
        </div>
      )}

      <div
        className="drop-area"
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
        />
        <p className="text-lg">Drag & Drop HEIC files here, or click to select</p>
        <p className="text-sm">Max file size: {MAX_FILE_SIZE_MB}MB per file</p>
        {heicFiles.length > 0 && (
          <div className="selected-files-container">
            <h3 className="selected-files-title">Selected Files:</h3>
            <div className="thumbnails-grid">
              {heicFiles.map((item, index) => (
                <div key={index} className="thumbnail-item">
                  <img src={item.thumbnail} alt={item.file.name} />
                  <span>{item.file.name}</span>
                </div>
              ))}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                heicFiles.forEach(item => URL.revokeObjectURL(item.thumbnail)); // Revoke existing thumbnails
                setHeicFiles([]);
                convertedImages.forEach(image => URL.revokeObjectURL(image.url)); // Revoke converted image URLs
                setConvertedImages([]);
                setError(null);
              }}
              className="clear-all-button"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      <div className="controls-container">
        <label htmlFor="outputFormat" className="output-format-label">Output Format:</label>
        <select
          id="outputFormat"
          value={outputFormat}
          onChange={(e) => setOutputFormat(e.target.value)}
          className="output-format-select"
        >
          <option value="jpeg">JPG</option>
          <option value="png">PNG</option>
        </select>
        <button
          onClick={convertImages}
          disabled={heicFiles.length === 0 || loading}
          className="convert-button"
        >
          {loading ? 'Converting...' : 'Convert'}
        </button>
      </div>

      {loading && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p className="loading-text">Processing images...</p>
        </div>
      )}

      {convertedImages.length > 0 && (
        <div className="converted-images-section">
          <h2 className="converted-images-title">Converted Images</h2>
          <div className="image-gallery">
            {convertedImages.map((image) => (
              <div key={image.id} className="image-card">
                <img src={image.url} alt={image.name} />
                <div className="image-card-content">
                  <p className="image-name">{image.name}</p>
                  <button
                    onClick={() => downloadImage(image)}
                    className="download-button"
                  >
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="download-all-container">
            <button
              onClick={downloadAllImages}
              disabled={convertedImages.length === 0 || loading}
              className="download-all-button"
            >
              Download All as ZIP
            </button>
          </div>
        </div>
      )}
      <p className="privacy-statement">All image conversion is performed locally in your browser on your device, and your photos are never uploaded to any server, stored, accessed, or seen by us. Your privacy is fully respected ❤️</p>
    </div>
  );
}

export default App;
