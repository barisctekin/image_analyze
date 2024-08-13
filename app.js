import fs from 'fs';
import * as dotenv from 'dotenv';
import axios from 'axios';
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const encodeImage = (imagePath) => {
  const imageFile = fs.readFileSync(imagePath);
  return Buffer.from(imageFile).toString('base64');
};

const generateDynamicQuestions = (vehicleInfo) => {
  return [
    {
      type: 'text',
      text: `Görsellerde markası ${vehicleInfo.brand}, modeli ${vehicleInfo.model} olan araç var mı?`
    },
    {
      type: 'text',
      text: `Görsellerde ${vehicleInfo.plate} plakalı araç var mı?`
    },
    {
      type: 'text',
      text: `Görsellerde ${vehicleInfo.plate} plakalı aracın dıştan görünümüne ait görseli varsa aracın rengiyle birlikte hangi parçalarının hasar gördüğünü ve hasarların derecesini belirt.`
    },
    {
      type: 'text',
      text: `Görsellerde ${vehicleInfo.plate} plakalı aracın içten görünümüne ait görseli varsa aracın hangi parçalarının hasar gördüğünü, hava yastıklarının patlayıp patlmadığını, kırık cam ve yangın izi olup olmadığını belirt.`
    },
    {
      type: 'text',
      text: `Görsellerde ${vehicleInfo.plate} plakalı aracın kaza anına ait görseli varsa kazanın ciddiyetini ve olayın nasıl gerçekleşmiş olabileceğini açıkla.`
    }


  ];
};

const analyzeImageGroup = async (imageGroup, vehicleInfo) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const base64Images = imageGroup.map(encodeImage);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  const questions = generateDynamicQuestions(vehicleInfo);
  const payload = {
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          ...questions,
          ...base64Images.map(base64Image => ({
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`
            }
          }))
        ]
      }
    ],
    max_tokens: 300
  };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, { headers });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(error);
    return null;
  }
};

const chunkArray = (array, chunkSize) => {
  const results = [];
  let index = 0;
  while (index < array.length) {
    results.push(array.slice(index, index + chunkSize));
    index += chunkSize;
  }
  return results;
};

const analyzeImagesInDirectory = async (directoryPath, vehicleInfo) => {
  const files = fs.readdirSync(directoryPath);
  const imageFiles = files.filter(file => /\.(jpg|jpeg|png)$/i.test(file));

  const imagePaths = imageFiles.map(file => path.join(directoryPath, file));
  const imageGroups = chunkArray(imagePaths, 5); // Görselleri 5'li gruplara böl

  const analyses = await Promise.all(imageGroups.map(group => analyzeImageGroup(group, vehicleInfo)));

  // Grupların analiz sonuçlarını birleştir
  const combinedAnalysis = analyses.join("\n");

  // Gruplardaki cevaplardan genel bir özet oluştur
  const summaryPayload = {
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: `Aşağıda verilen trafik kazası olayına ait gruplandırılmış görsellerin analiz sonuçlarını genel bir özet haline getirip sonuçlandır:\n\n${combinedAnalysis}`
      }
    ],
    max_tokens: 300
  };

  try {
    const summaryResponse = await axios.post('https://api.openai.com/v1/chat/completions', summaryPayload, { headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` } });
    const summary = summaryResponse.data.choices[0].message.content;

    return summary;
  } catch (error) {
    console.error(error);
    return null;
  }
};

app.post('/analyze-images', async (req, res) => {
  const { directoryPath, vehicleInfo } = req.body;

  if (!directoryPath) {
    return res.status(400).json({ error: 'Directory path is required' });
  }

  if (!vehicleInfo || !vehicleInfo.brand || !vehicleInfo.model || !vehicleInfo.plate) {
    return res.status(400).json({ error: 'Vehicle information (brand, model, plate) is required' });
  }

  try {
    const analysis = await analyzeImagesInDirectory(directoryPath, vehicleInfo);
    console.log("Genel Özet:\n", analysis);
    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: 'Error analyzing images' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
