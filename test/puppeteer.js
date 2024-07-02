#!/usr/bin/env node

import puppeteer from  'puppeteer';
import path from  'path';
import fs from 'fs';
import express from 'express';
import url from 'url';
const app = express();
const port = 3000;
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));  // eslint-disable-line

app.use(express.static(path.dirname(__dirname)));
const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
  test(port);
});

function makePromiseInfo() {
  const info = {};
  const promise = new Promise((resolve, reject) => {
    Object.assign(info, {resolve, reject});
  });
  info.promise = promise;
  return info;
}

const exampleInjectJS = fs.readFileSync('test/src/js/example-inject.js', {encoding: 'utf-8'});

function getExamples(port) {
  return fs.readdirSync('examples')
      .filter(f => f.endsWith('.html'))
      .map(f => ({
        url: `http://localhost:${port}/examples/${f}`,
        js: exampleInjectJS,
        screenshot: true,
      }));
}

async function test(port) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      //'--enable-unsafe-webgpu',
      //'--enable-webgpu-developer-features',
      //'--use-angle=swiftshader',
      '--user-agent=puppeteer',
    ],
  });
  const page = await browser.newPage();

  page.on('console', async e => {
    const args = await Promise.all(e.args().map(a => a.jsonValue()));
    console.log(...args);
  });

  let totalFailures = 0;
  let waitingPromiseInfo;

  // Get the "viewport" of the page, as reported by the page.
  page.on('domcontentloaded', async () => {
    const failures = await page.evaluate(() => {
      return window.testsPromiseInfo.promise;
    });

    totalFailures += failures;

    waitingPromiseInfo.resolve();
  });

  const testPages = [
    {url: `http://localhost:${port}/test/index.html?reporter=spec` },
    ...getExamples(port),
  ];

  for (const {url, js, screenshot} of testPages) {
    waitingPromiseInfo = makePromiseInfo();
    console.log(`===== [ ${url} ] =====`);
    const id = js
      ? await page.evaluateOnNewDocument(js)
      : undefined;
    await page.goto(url);
    await page.waitForNetworkIdle();
    if (js) {
      await page.evaluate(() => {
        setTimeout(() => {
          window.testsPromiseInfo.resolve(0);
        }, 10);
      });
    }
    await waitingPromiseInfo.promise;
    if (screenshot) {
      const dir = 'screenshots';
      fs.mkdirSync(dir, { recursive: true });
      const name = /\/([a-z0-9_-]+).html/.exec(url)[1];
      const path = `${dir}/${name}.png`;
      await page.screenshot({path});
    }
    if (js) {
      await page.removeScriptToEvaluateOnNewDocument(id.identifier);
    }
  }

  await browser.close();
  server.close();

  process.exit(totalFailures ? 1 : 0);  // eslint-disable-line
}
