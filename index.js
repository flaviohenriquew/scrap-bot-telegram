require('dotenv').config();
const { Markup, Telegraf } = require('telegraf');
const puppeteer = require("puppeteer");
const bot = new Telegraf(process.env.BOT_TOKEN);
const request = require("request");
const fetch = require('node-fetch');
const prettylink = require('prettylink');
const bitly = new prettylink.Bitly('7307fa60b749efb3072afa4dfe6c4fa132c0e12e');
const crypto = require("crypto");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const API_URL = "http://gw.api.taobao.com/router/rest";
const API_SECRET = "5ceee05e3d0a458dc27992c386e67911";
const API_KEY = "33857614";

const hash = (method, s, format) => {
	const sum = crypto.createHash(method);
	const isBuffer = Buffer.isBuffer(s);
	if (!isBuffer && typeof s === "object") {
		s = JSON.stringify(sortObject(s));
	}
	sum.update(s, "utf8");
	return sum.digest(format || "hex");
};

const sortObject = (obj) => {
	return Object.keys(obj)
		.sort()
		.reduce(function (result, key) {
			result[key] = obj[key];
			return result;
		}, {});
};

const signRequest = (parameters) => {
	const sortedParams = sortObject(parameters);
	const sortedString = Object.keys(sortedParams).reduce((acc, objKey) => {
		return `${acc}${objKey}${sortedParams[objKey]}`;
	}, "");

	const bookstandString = `${API_SECRET}${sortedString}${API_SECRET}`;
	const signedString = hash("md5", bookstandString, "hex");
	return signedString.toUpperCase();
};

const getProductById = async (productId) => {
	const timestamp = dayjs().tz("America/Recife").format("YYYY-MM-DD HH:mm:ss");

	const payload = {
		method: "aliexpress.affiliate.productdetail.get",
		app_key: API_KEY,
		sign_method: "md5",
		timestamp,
		format: "json",
		v: "2.0",
		product_ids: productId,
		target_currency: "BRL",
		target_language: "PT",
	};

	const sign = signRequest(payload);

	const allParams = {
		...payload,
		sign,
	};

	const res = await fetch(API_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
		},
		body: new URLSearchParams(allParams),
	});

	const json = await res.json();

	// Logging the API response for debugging
	console.log('API Response:', JSON.stringify(json, null, 2));

	// Check if the response contains the expected properties
	if (json.aliexpress_affiliate_productdetail_get_response &&
		json.aliexpress_affiliate_productdetail_get_response.resp_result &&
		json.aliexpress_affiliate_productdetail_get_response.resp_result.result) {
		return json;
	} else {
		throw new Error('Invalid API response structure');
	}
};

function doRequest(url) {
	return new Promise((resolve, reject) => {
		request({ url: url, followRedirect: false }, async function (error, response, body) {
			if (response.statusCode >= 300 && response.statusCode < 400) {
				resolve(await response.headers.location);
			}
			reject(error);
		});
	});
}

// BOT casa e cozinha
bot.hears(/casa (.+)/gi, async ctx => {
	let match = ctx.match[1].split(',');
	match = match[0];
	const start = match.substring(match.indexOf('.br/') + 4);
	const end = start.indexOf('/');
	const newString = start.substring(0, end);
	const url = match.replace(newString, 'magazinecasadapromocoes');
	console.log(url);

	const browser = await puppeteer.launch({headless: false});
	const page = await browser.newPage();
	console.log("Iniciado");
	await page.goto(url);
	console.log("Entrou na URL");

	let amazon = url.match(/amazon.com.br+/g);
	let lojasrenner = url.match(/lojasrenner.com.br+/g);
	let magazinevoce = url.match(/magazinevoce.com.br+/g);

	if(amazon) {
		await page.waitForSelector('.itemNo0');
		const imagem = await page.$eval('.itemNo0 > span > span > div > img',element => element.getAttribute("src"));

		await page.waitForSelector('#productTitle');
		const titulo = await page.$eval('#productTitle',element => element.innerText);

		await page.waitForSelector('#featurebullets_feature_div');
		const sobre = await page.$eval('#featurebullets_feature_div > div',element => element.innerHTML);

		let valor = await page.evaluate(()=>{const el = document.querySelector('#snsDetailPagePrice');
			if(!el){ return null }else{return el.innerText;}
		});
		if(!valor) {
			valor = await page.evaluate(()=>{ const el = document.querySelector('#corePrice_desktop > div >table > tbody > tr > td.a-span12 > span > span > span');
				if(!el) {return null}else{return el.innerText;}
			});
		}
		if(!valor) {
			valor = await page.evaluate(()=>{ const el = document.querySelector('.priceToPay > .a-offscreen');
				if(!el){ return null}else {return el.innerText;}
			});
		}

		let parcelamento = await page.evaluate(()=>{  const el = document.querySelector('.best-offer-name');
			if(!el) {return null}else{return el.innerText;}
		});
		if(!parcelamento){	parcelamento = '';	}

		let colorname = await page.evaluate(()=>{   const el = document.querySelector('#variation_color_name > div >label');
			if(!el) {return null}else{return el.innerText;}
		});
		if(colorname) {
			await page.waitForSelector('#variation_color_name');
			let varcolors = await page.evaluate(()=>{
				const varcolor = document.querySelectorAll('#variation_color_name > ul > li > span >div > span > span > span > button > div > div >img');
				if (varcolor) {
					let strlistcn = '';
					for (var i = 0; i < varcolor.length; i++) { if(i === varcolor.length - 1) {strlistcn += varcolor[i].alt;}else{strlistcn += varcolor[i].alt+', ';} }
					return strlistcn;
				}
			});
			if(colorname && varcolors){	colorname = '<b>'+colorname+'</b> '+varcolors; }
		}
		if(!colorname){	colorname = '';	}

		if (valor) {
			await bot.telegram.sendPhoto(process.env.CHAT_ID, imagem, {
				caption: `
			${titulo}
			
${colorname}

			👉🏼 <b>Preço</b>: ${valor} ${parcelamento}
		`,
				reply_markup: {
					inline_keyboard: [[{ text: "✅ Comprar agora", url: url }]]
				},
				parse_mode: 'HTML'
			});
		}
	} else if(lojasrenner) {
		await page.waitForSelector('.open-gallery.slick-slide.slick-current');
		let imagem = await page.$$eval('.open-gallery.slick-slide.slick-current > img',element => element.map(src =>src.src));
		imagem = imagem[0];

		await page.waitForSelector('.product_name');
		const titulo = await page.$eval('.product_name > span',element => element.innerText);

		let colorname = '';

		await page.waitForSelector('.wrap_size');
		let varcolors = await page.evaluate(()=>{
			const varcolor = document.querySelectorAll('.wrap_size > div.variants-carousel.slick-initialized.slick-slider > div.slick-list.draggable > div.slick-track > label.label.js-select-label.slick-slide.slick-active > div.content > span.nome');
			if (varcolor) {
				let strlistcn = '';
				return varcolor;
			}else{return  null;}
		});

		let valor = '123';
		let parcelamento = '';

		if (valor) {
			await bot.telegram.sendPhoto(process.env.CHAT_ID, imagem, {
				caption: `
			${titulo}
			
${colorname}

			👉🏼 <b>Preço</b>: ${valor} ${parcelamento}
		`,
				reply_markup: {
					inline_keyboard: [[{ text: "✅ Comprar agora", url: url }]]
				},
				parse_mode: 'HTML'
			});
		}
	} else if(magazinevoce) {
		await page.waitForSelector('.pgallery');
		const imagem = await page.$eval('.pgallery > div.photo.hide-mobile > img',element => element.getAttribute("src"));

		await page.waitForSelector('div.product > h3.hide-mobile');
		let titulo = await page.$eval('div.product > h3.hide-mobile',element => element.innerText);
		titulo = titulo.split('\n')[0];

		await page.waitForSelector('.p-price');
		let valor = await page.$eval('div[class="p-price"]', valor => valor.innerText);
		valor = valor.split('\n')[1];

		await page.waitForSelector('.p-through');
		let valororiginal = await page.$eval('small[class="p-through"]', valor => valor.innerText);
		console.log("valororiginal",valororiginal);

		if (valor) {
			await bot.telegram.sendPhoto(process.env.CHAT_ID, imagem, {
				caption: `
			${titulo}

			👉🏼 <b>Preço</b>: ${valor} 🔥 <s>${valororiginal}</s>
		`,
				reply_markup: {
					inline_keyboard: [[{ text: "✅ Comprar agora", url: url }]]
				},
				parse_mode: 'HTML'
			});
		}
	} else {
		console.log("ops");
	}

	await page.waitForTimeout(3000);
	await browser.close();
	console.log('closing browser');
});

bot.hears(/./gi, async (ctx) => {
	let browser, page;
	const match = ctx.message.text.split(/\n/g);
	let url = match[0];
	let cupom = match[1];
	console.log(match[0]);

	let link = null;
	let dados = null;
	let isAffiliate = null;

	try {
		if (/\/item\/[0-9]/gi.test(url)) {
			link = url.substring(url.indexOf('item/') + 5, url.indexOf('.html')) || null;
			dados = await getProductById(String(link)) || null;
			isAffiliate = dados.aliexpress_affiliate_productdetail_get_response.resp_result.result.current_record_count || false;
		}

		if (/a\.aliexpress\.com/gi.test(url)) {
			const res = await doRequest(url);
			link = res.substring(res.indexOf('item/') + 5, res.indexOf('.html'));
			dados = await getProductById(String(link)) || null;
			isAffiliate = dados.aliexpress_affiliate_productdetail_get_response.resp_result.result.current_record_count || false;
			console.log(isAffiliate);
			cupom = 'Sem cupom para esta oferta';
		}

		if (isAffiliate) {
			const produto = await dados.aliexpress_affiliate_productdetail_get_response.resp_result.result.products;
			const video = produto.product[0].product_video_url;
			const titulo = produto.product[0].product_title;
			const price = produto.product[0].target_app_sale_price;
			const image = produto.product[0].product_main_image_url;
			let promotion = produto.product[0].promotion_link;
			const original_price = produto.product[0].target_original_price;

			console.log(video);

			await bitly.short(promotion).then((result) => {
				promotion = result.link;
			}).catch((err) => {
				promotion = err.link;
			});

			if (video) {
				await ctx.telegram.sendVideo('@canaltestebo', video, {
					caption: `
						${titulo}
						
						CUPOM: <span class="tg-spoiler">${cupom ? cupom.replace(/cupom:/gi, '') : 'Sem cupom para esta oferta'}</span>
						
						👉🏼 <b>Preço</b>: R$ ${price} 🔥 <s>${original_price}</s>
					`,
					reply_markup: {
						inline_keyboard: [[{ text: "✅ Comprar agora", url: promotion }]]
					},
					parse_mode: 'HTML'
				});
				return;
			}

			await ctx.telegram.sendPhoto('@canaltestebo', image, {
				caption: `
					${titulo}
					
					CUPOM: <span class="tg-spoiler">${cupom ? cupom.replace(/cupom:/gi, '') : 'Sem cupom para esta oferta'}</span>
					
					👉🏼 <b>Preço</b>: R$ ${price} 🔥 <s>${original_price}</s>
				`,
				reply_markup: {
					inline_keyboard: [[{ text: "✅ Comprar agora", url: promotion }]]
				},
				parse_mode: 'HTML'
			});
		} else {
			console.log('O produto não tem comissão!');
			ctx.reply('O produto não tem comissão!');
		}
	} catch (error) {
		console.log('Error:', error.message);
		ctx.reply(`An error occurred: ${error.message}`);
	}
});

bot.hears(/teste (.+)/gi, async ctx => {
	let browser, page;
	const match = ctx.match[1].split(',');
	const url = match[0];
	const linkAffiliate = match[1];

	try {
		console.log('opening browser');
		browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
		page = await browser.newPage();
		await page.setDefaultNavigationTimeout(0);
		page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });

		await page.goto(url, { waitUntil: ['networkidle2'] });

		await page.waitForSelector('meta[property="og:title"]', { visible: false });

		const itens = ['og:title', 'og:image'];
		const getTitleAndImage = await page.evaluate((itens) => {
			const dados = [{ 'og:title': null, 'og:image': null, 'video': null, 'prices': null }];
			itens.forEach(selector => {
				const item = document.querySelector(`meta[property='${selector}']`).getAttribute("content");
				selector === 'og:title'
					? dados[0]['og:title'] = item
					: dados[0]['og:image'] = item;
			});
			const video = document.querySelector(`video[id='item-video']`)?.getAttribute("src") || null;
			const prices = document.querySelector(`meta[property="og:title"]`).getAttribute("content");
			dados[0]['video'] = video;
			dados[0]['prices'] = prices.split('|')[0];
			return dados;
		}, itens);

		console.log(getTitleAndImage);
		const video = getTitleAndImage[0].video;
		const titulo = getTitleAndImage[0]['og:title'].split('|')[1];
		const image = getTitleAndImage[0]['og:image'];
		const priceCompleted = getTitleAndImage[0].prices.replace('R$', ' 🔥');

		if (video) {
			await bot.telegram.sendVideo(process.env.CHAT_ID, video, {
				caption: `
	${titulo}
	
	👉🏼 <b>Preço</b>: R$ ${priceCompleted} 
	`,
				reply_markup: {
					inline_keyboard: [[{ text: "✅ Comprar agora", url: linkAffiliate }]]
				},
				parse_mode: 'HTML'
			});
		}

		if (!video) {
			await bot.telegram.sendPhoto(process.env.CHAT_ID, image, {
				caption: `
	${titulo}
	
	👉🏼 <b>Preço</b>: R$ ${priceCompleted} 🔥
	`,
				reply_markup: {
					inline_keyboard: [[{ text: "✅ Comprar agora", url: linkAffiliate }]]
				},
				parse_mode: 'HTML'
			});
		}

	} catch (error) {
		console.log('scrape error', error.message);
	} finally {
		if (browser) {
			await browser.close();
			console.log('closing browser');
		}
	}
});

// BOT HOTEL URBANO CLUBEHU
async function getDados(url, ctx) {
	let browser, page;

	try {
		console.log('opening browser');
		browser = await puppeteer.launch({
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
			'ignoreHTTPSErrors': true
		});
		page = await browser.newPage();
		await page.setDefaultNavigationTimeout(0);
		page.setViewport({ width: 1260, height: 768, deviceScaleFactor: 1 });

		await page.goto(url, { waitUntil: ['networkidle2'] });

		const el = await page.waitForSelector('body > div:nth-child(6) > section > div.box-offer-top.box-nopadding.col-sm-6.col-md-6 > div');

		let titulo = await page.evaluate(element => {
			return element.textContent;
		}, (await page.$$('.package-title'))[0]);
		console.log(titulo);

		let descricao = await page.evaluate(element => {
			return element.textContent;
		}, (await page.$$('.description'))[0]);
		console.log(descricao);

		let diarias = await page.evaluate(element => {
			return element.textContent;
		}, (await page.$$('.daily-container'))[0]);
		console.log(diarias);

		let ariaLive = await page.evaluate(element => {
			return element.textContent;
		}, (await page.$x('//*[@aria-live="polite"]'))[0]);
		console.log(ariaLive);

		let periodo1 = await page.evaluate(element => {
			return element.getAttribute('data-date');
		}, (await page.$x('//*[@class="formated-date"]'))[0]);
		console.log(periodo1);

		let periodo2 = await page.evaluate(element => {
			return element.getAttribute('data-date');
		}, (await page.$x('//*[@class="formated-date"]'))[2]);
		console.log(periodo2);

		let aPartirDe = await page.evaluate(element => {
			return element.getAttribute('data-promotion-price-original');
		}, (await page.$x('//*[@class="promotion-price-original promotion-currency old-price"]'))[0]);
		console.log(aPartirDe);

		let preco = await page.evaluate(element => {
			return element.getAttribute('data-price');
		}, (await page.$x('//*[@class="offer-top--price offer--price promotion-price"]'))[0]);
		console.log(preco);

		let image = await page.evaluate(element => {
			return element.getAttribute('data-desktop-uri');
		}, (await page.$x('//*[@class="photo-image retina-image"]'))[0]);

		console.log(ariaLive);
		console.log(periodo1, periodo2);
		console.log(aPartirDe, preco);

		titulo = titulo.trim();
		descricao = descricao.trim();
		diarias = diarias
			.split(/\n/g)
			.filter(el => el.trim())
			.reduce((acc, item) => acc += `${item.trim()} `, '');
		ariaLive = ariaLive
			.split(/\n/g)
			.filter(el => el.trim())
			.reduce((acc, item) => acc += `${item.trim()} + `, '');
		ariaLive = ariaLive.substring(0, ariaLive.length - 2);
		periodo1 = periodo1.trim().replace(/(\d*)-(\d*)-(\d*).*/, '$3-$2-$1');
		periodo2 = periodo2.trim().replace(/(\d*)-(\d*)-(\d*).*/, '$3-$2-$1');
		aPartirDe = aPartirDe.trim();
		preco = preco.trim();

		await bot.telegram.sendPhoto('@promotipviagens', `https:${image}`, {
			caption: `
	<b>${titulo}</b>
	${descricao}
	
	☀️ ${diarias}
	✅ ${ariaLive}
	🗓 ${periodo1} a ${periodo2}
	
	👉🏼 <b>Preço</b>: R$ <span class="tg-spoiler">${preco}</span> + Taxas 🔥 <s>${aPartirDe}</s>
	
	⚠️ Verifique o regulamento da oferta!
	`,
			reply_markup: {
				inline_keyboard: [[{ text: "✅ Comprar agora", url: url }]]
			},
			parse_mode: 'HTML'
		});
		await page.deleteCookie();
	} catch (error) {
		console.log('scrape error', error);
		ctx.reply(error.message);
	} finally {
		if (browser) {
			await browser.close();
			console.log('closing browser');
			ctx.reply('Dados enviados para o grupo PromoTip Viagens');
		}
	}
}

bot.launch();
