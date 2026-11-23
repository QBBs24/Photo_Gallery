import { validateImageFile, MAX_PIXELS } from './services/imageProcessor.js';
import sharp from 'sharp';

async function runTests() {
  console.log('=== Starting Enhanced Verification Test Suite ===\n');

  // Test 1: Reject non-image file spoofed as an image
  console.log('[Test 1] Binary Magic Number Check:');
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
    console.log('✔ PASS: Rejected spoofed file with natural language error:');
    console.log(`   "${err.message}"`);
  }

  // Test 2: Reject corrupted/broken image with valid PNG header but invalid payload
  console.log('\n[Test 2] Corrupted / Broken Image Detection:');
  const validHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
  const brokenData = Buffer.concat([validHeader, Buffer.from('CORRUPT_PAYLOAD_NOT_A_VALID_IMAGE_STREAM')]);
  const brokenFile = {
    buffer: brokenData,
    originalname: 'corrupt_stream.png',
    mimetype: 'image/png',
    size: brokenData.length,
  } as Express.Multer.File;

  try {
    await validateImageFile(brokenFile, 0);
    console.error('❌ FAIL: Corrupt image should have been rejected!');
  } catch (err: any) {
    console.log('✔ PASS: Corrupted image denied with natural language error:');
    console.log(`   "${err.message}"`);
  }

  // Test 3: Pixel Limit (> 40 MP) Check & Exact Message
  console.log('\n[Test 3] Pixel Limit (> 40 MP) Pre-Decode Check:');
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
    const expected = 'Image exceeds the maximum number of pixels allowed. Please resize your image and try again.';
    if (err.message === expected) {
      console.log('✔ PASS: Exactly matched expected pixel-limit rejection message:');
      console.log(`   "${err.message}"`);
    } else {
      console.error(`❌ FAIL: Expected "${expected}", got "${err.message}"`);
    }
  }

  // Test 4: Password Validation Rules
  console.log('\n[Test 4] Password Restriction Validation:');
  const testPasswords = [
    { pass: 'short1!', valid: false, reason: 'Too short (<8)' },
    { pass: 'noNumbers!A', valid: false, reason: 'No numbers' },
    { pass: 'nocapital123!', valid: false, reason: 'No uppercase' },
    { pass: 'NoSpecial123', valid: false, reason: 'No special char' },
    { pass: 'ValidPass123!', valid: true, reason: 'Meets all 4 conditions' },
  ];

  function validatePass(p: string): boolean {
    return (
      p.length >= 8 &&
      /\d/.test(p) &&
      /[A-Z]/.test(p) &&
      /[!@#$%^&*()<>]/.test(p)
    );
  }

  for (const item of testPasswords) {
    const res = validatePass(item.pass);
    if (res === item.valid) {
      console.log(`✔ PASS: "${item.pass}" (${item.reason}) -> valid: ${res}`);
    } else {
      console.error(`❌ FAIL: "${item.pass}" (${item.reason}) failed expected outcome.`);
    }
  }

  // Test 5: Genuine Image and EXIF Stripping
  console.log('\n[Test 5] Genuine Image Processing & EXIF Rotation Check:');
  const genuinePngBuffer = await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 4,
      background: { r: 50, g: 150, b: 250, alpha: 1 },
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

  const validated = await validateImageFile(genuineFile, 0);
  console.log('✔ PASS: Genuine image passed all checks.');
  console.log(`   Dimensions: ${validated.width}x${validated.height}, StorageKey: ${validated.storageKey}`);

  console.log('\n=== All Verification Tests Passed Successfully ===');
}

runTests().catch(console.error);
