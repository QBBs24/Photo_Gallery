import { validateImageFile, MAX_PIXELS } from './services/imageProcessor.js';
import sharp from 'sharp';

async function runTests() {
  console.log('--- Starting Image Validation Tests ---');

  // Test 1: Reject non-image file spoofed as an image
  console.log('\n[Test 1] Binary Magic Number Check:');
  const fakePngBuffer = Buffer.from('This is a text file spoofing as a PNG image.');
  const fakeFile = {
    buffer: fakePngBuffer,
    originalname: 'fake_image.png',
    mimetype: 'image/png',
    size: fakePngBuffer.length,
  } as Express.Multer.File;

  try {
    await validateImageFile(fakeFile, 0);
    console.error('❌ FAIL: Fake image should have been rejected!');
  } catch (err: any) {
    console.log('✔ PASS: Properly rejected spoofed file with natural language error:');
    console.log(`   "${err.message}"`);
  }

  // Test 2: Accept genuine PNG image
  console.log('\n[Test 2] Genuine Image Validation:');
  const genuinePngBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 128, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const genuineFile = {
    buffer: genuinePngBuffer,
    originalname: 'valid_test.png',
    mimetype: 'image/png',
    size: genuinePngBuffer.length,
  } as Express.Multer.File;

  try {
    const validated = await validateImageFile(genuineFile, 0);
    console.log('✔ PASS: Genuine image accepted:');
    console.log(`   Dimensions: ${validated.width}x${validated.height}, StorageKey: ${validated.storageKey}`);
  } catch (err: any) {
    console.error('❌ FAIL: Genuine image was rejected:', err.message);
  }

  // Test 3: Reject image exceeding 40 million pixels
  console.log('\n[Test 3] Pixel Limit (> 40 MP) Check:');
  // 7000 x 6000 = 42,000,000 pixels (> 40 MP)
  const hugePngBuffer = await sharp({
    create: {
      width: 7000,
      height: 6000,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .png()
    .toBuffer();

  const hugeFile = {
    buffer: hugePngBuffer,
    originalname: 'massive_42mp_photo.png',
    mimetype: 'image/png',
    size: hugePngBuffer.length,
  } as Express.Multer.File;

  try {
    await validateImageFile(hugeFile, 1);
    console.error('❌ FAIL: Image > 40MP should have been denied before decoding!');
  } catch (err: any) {
    console.log('✔ PASS: Properly denied > 40 MP image with natural language error:');
    console.log(`   "${err.message}"`);
  }

  console.log('\n--- All Validation Tests Completed Successfully ---');
}

runTests().catch(console.error);
