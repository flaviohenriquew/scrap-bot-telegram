require('dotenv').config();
const { Markup, Telegraf } = require('telegraf')
const puppeteer = require("puppeteer");
const bot = new Telegraf(process.env.BOT_TOKEN)
const request = require("request");
const fetch = require('node-fetch')
//bot.telegram.sendMessage(process.env.CHAT_ID, 'Hello Telegram!');
//const scrape = require('aliexpress-product-scraper');
//const product = scrape('1005003557398937');

//product.then(res => {
//  console.log('The JSON: ', res);
//});
const prettylink = require('prettylink');
const bitly = new prettylink.Bitly('7307fa60b749efb3072afa4dfe6c4fa132c0e12e');

// getAffiliateLInk
const crypto = require("crypto")
const dayjs = require("dayjs")
const utc = require("dayjs/plugin/utc")
const timezone = require("dayjs/plugin/timezone")

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

	return await res.json()
}

function doRequest(url) {
	return new Promise((resolve, reject) => {
		request({ url: url, followRedirect: false }, async function (error, response, body) {
			//console.log(response.statusCode);
			if (response.statusCode >= 300 && response.statusCode < 400) {
				resolve(await response.headers.location)
			}
			reject(error)
		})
	})
}



// BOT casa e cozinha
bot.hears(/casa (.+)/gi, async ctx => {
	console.log("teste");
	const match = ctx.match[1].split(',');
	const url = match[0]
	//const linkAffiliate = match[1]

	let amazon = url.match(/amazon.com.br+/g);
	if(amazon) {
		console.log('opening browser');
		const browser = await puppeteer.launch({headless: false});//{ args: ['--no-sandbox', '--disable-setuid-sandbox',] });
		const page = await browser.newPage();
		console.log("Iniciado");
		await page.goto(url); //entrando na página
		console.log("Entrou na URL");

		await page.waitForSelector('.itemNo0'); //aguardando a pagina carregar o id para ir pra prox linha
		const imagem = await page.$eval('.itemNo0 > span > span > div > img',element => element.getAttribute("src")); //pega a imagem

		await page.waitForSelector('#productTitle'); //aguardando a pagina carregar o id para ir pra prox linha
		const titulo = await page.$eval('#productTitle',element => element.innerText); //pega o titulo

		await page.waitForSelector('#featurebullets_feature_div'); //aguardando a pagina carregar o id para ir pra prox linha
		const sobre = await page.$eval('#featurebullets_feature_div > div',element => element.innerHTML); //pega o valor

		let valor = await page.evaluate(()=>{ const el = document.querySelector('#snsDetailPagePrice'); if(!el){ return null }else{return el.innerText;}  })
		if(!valor) {
			valor = await page.evaluate(()=>{ const el = document.querySelector('#corePrice_desktop > div >table > tbody > tr > td.a-span12 > span > span > span'); if(!el) {return null}else{return el.innerText;}  })
		}
		if(!valor) {
			valor = await page.evaluate(()=>{ const el = document.querySelector('.priceToPay > .a-offscreen'); if(!el){ return null}else {return el.innerText;}  })
		}

		let parcelamento = await page.evaluate(()=>{  const el = document.querySelector('.best-offer-name'); if(!el) {return null}else{return el.innerText;}  })
		if(!parcelamento){	parcelamento = '';	}

		let colorname = await page.evaluate(()=>{
			const el = document.querySelector('#variation_color_name > div >label'); if(!el) {return null}else{return el.innerText;}
		})
		if(colorname) {
			await page.waitForSelector('#variation_color_name'); //aguarda até a classe carregar
			let varcolors = await page.evaluate(()=>{
				const varcolor = document.querySelectorAll('#variation_color_name > ul > li > span >div > span > span > span > button > div > div >img');
				if (varcolor) {
					let strlistcn = '';
					for (var i = 0; i < varcolor.length; i++) {		if(i === varcolor.length - 1) {strlistcn += varcolor[i].alt;}else{strlistcn += varcolor[i].alt+', ';}	}
					return strlistcn;
				}
			})
			if(colorname && varcolors){	colorname = '<b>'+colorname+'</b> '+varcolors	}
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
			})
		}


		await page.waitForTimeout(3000);

		await browser.close();
		console.log('closing browser');


	}else{
		console.log("ops");
	}


	/*} catch (error) {
		console.log('scrape error', error.message);
	}*//*finally {

		if (browser) {
			await browser.close();
			console.log('closing browser');
		}
	}*/
})

bot.hears(/./gi, async (ctx) => {
	let browser, page;
	const match = ctx.message.text.split(/\n/g);
	let url = match[0]
	let cupom = match[1]
		console.log(match[0])
	//const linkAffiliate = match[1]
	
	let link = null
	let dados = null
	let isAffiliate = null
	//console.log(ctx.message.text)
	
	if (/viajar\.hu/gi.test(url)) {
		console.log(url)
		const res = await doRequest(url)
		const link2 = res.substring(res.indexOf('/aud/') + 5)
		getDados(link2, ctx)
		return
	}

	if (/\/item\/[0-9]/gi.test(url)) {
		url = match[0]
		link = url.substring(url.indexOf('item/') + 5, url.indexOf('.html')) || null
		dados = await getProductById(String(link)) || null
		isAffiliate = await dados.aliexpress_affiliate_productdetail_get_response.resp_result.result.current_record_count || false
	}

	if (/a\.aliexpress\.com/gi.test(match)) {
		url = match[1]
		link = url.substring(url.indexOf('https')) || null
		const res = await doRequest(link)
		link = res.substring(res.indexOf('item/') + 5, res.indexOf('.html'))
		dados = await getProductById(String(link)) || null
		isAffiliate = await dados.aliexpress_affiliate_productdetail_get_response.resp_result.result.current_record_count || false
		console.log(isAffiliate)
		cupom = 'Sem cupom para esta oferta'
	}

	if (isAffiliate) {
		const produto = await dados.aliexpress_affiliate_productdetail_get_response.resp_result.result.products
		//console.log(produto)

		const video = produto.product[0].product_video_url
		const titulo = produto.product[0].product_title
		const price = produto.product[0].target_app_sale_price
		const image = produto.product[0].product_main_image_url
		let promotion = produto.product[0].promotion_link
		const original_price = produto.product[0].target_original_price
		console.log(video)
		await bitly.short(promotion).then((result) => {
			promotion = result.link
		}).catch((err) => {
			promotion = err.link
		});

		try {
			console.log('Consultando API');
			console.log(Boolean(video))
			
			if (video) {
				//console.log(video)
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
				})
				return
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
			})

		} catch (error) {
			console.log('scrape error', error);
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
			})
		} finally {
			console.log('Fechando API');
		}
	} else {
		console.log('O produto não tem comissão!')
		ctx.reply('O produto não tem comissão!')
	}
})

bot.hears(/teste (.+)/gi, async ctx => {
	let browser, page;
	const match = ctx.match[1].split(',');
	const url = match[0]
	const linkAffiliate = match[1]

	try {
		console.log('opening browser');
		browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox',] });
		page = await browser.newPage();
		await page.setDefaultNavigationTimeout(0);
		page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });

		await page.goto(url, { waitUntil: ['networkidle2'] });

		await page.waitForSelector('meta[property="og:title"]', { visible: false });

		// Scraper
		const itens = ['og:title', 'og:image']
		const getTitleAndImage = await page.evaluate((itens) => {
			const dados = [{ 'og:title': null, 'og:image': null, 'video': null, 'prices': null }]
			itens.forEach(selector => {
				const item = document.querySelector(`meta[property='${selector}']`).getAttribute("content");
				selector === 'og:title'
					? dados[0]['og:title'] = item
					: dados[0]['og:image'] = item
			})
			const video = document.querySelector(`video[id='item-video']`)?.getAttribute("src") || null
			const prices = document.querySelector(`meta[property="og:title"]`).getAttribute("content");
			dados[0]['video'] = video
			dados[0]['prices'] = prices.split('|')[0]
			return dados
		}, itens);

		//Array.from(document.getElementsByClassName('dynamic-shipping-titleLayout')).forEach(item => { dados.push({ 'Frete': item.innerText }) 
		//})
		console.log(getTitleAndImage)
		const video = getTitleAndImage[0].video
		const titulo = getTitleAndImage[0]['og:title'].split('|')[1]
		const image = getTitleAndImage[0]['og:image']
		const priceCompleted = getTitleAndImage[0].prices.replace('R$', ' 🔥')

		//👉🏼 <b>Preço</b>: R$ ${Number(priceFormatted).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

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
			})
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
			})
		}

	} catch (error) {
		console.log('scrape error', error.message);
	} finally {
		if (browser) {
			await browser.close();
			console.log('closing browser');
		}
	}
})

// BOT HOTEL URBANO CLUBEHU
async function getDados(url, ctx) {
	let browser, page;

	try {
		console.log('opening browser');
		//browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox',] });
		browser = await puppeteer.launch({
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
			'ignoreHTTPSErrors': true
		})
		page = await browser.newPage();
		await page.setDefaultNavigationTimeout(0);
		page.setViewport({ width: 1260, height: 768, deviceScaleFactor: 1 });

		await page.goto(url, { waitUntil: ['networkidle2'] });

		const el = await page.waitForSelector('body > div:nth-child(6) > section > div.box-offer-top.box-nopadding.col-sm-6.col-md-6 > div');
//		await delay(3000)

		let titulo = await page.evaluate(element => {
			return element.textContent;
		}, (await page.$$('.package-title'))[0])
		console.log(titulo)

		let descricao = await page.evaluate(element => {
			return element.textContent;
		}, (await page.$$('.description'))[0])
		console.log(descricao)

		let diarias = await page.evaluate(element => {
			return element.textContent;
		}, (await page.$$('.daily-container'))[0])
		console.log(diarias)

		let ariaLive = await page.evaluate(element => {
			return element.textContent;
		}, (await page.$x('//*[@aria-live="polite"]'))[0])
		console.log(ariaLive)

		let periodo1 = await page.evaluate(element => {
			return element.getAttribute('data-date');
		}, (await page.$x('//*[@class="formated-date"]'))[0])
		console.log(periodo1)

		let periodo2 = await page.evaluate(element => {
			return element.getAttribute('data-date');
		}, (await page.$x('//*[@class="formated-date"]'))[2])
		console.log(periodo2)

		let aPartirDe = await page.evaluate(element => {
			return element.getAttribute('data-promotion-price-original');
		}, (await page.$x('//*[@class="promotion-price-original promotion-currency old-price"]'))[0])
		console.log(aPartirDe)

		let preco = await page.evaluate(element => {
			return element.getAttribute('data-price');
		}, (await page.$x('//*[@class="offer-top--price offer--price promotion-price"]'))[0])
		console.log(preco)

		let image = await page.evaluate(element => {
			return element.getAttribute('data-desktop-uri');
		}, (await page.$x('//*[@class="photo-image retina-image"]'))[0])

		console.log(ariaLive)
		console.log(periodo1, periodo2)
		console.log(aPartirDe, preco)

		titulo = titulo.trim()
		descricao = descricao.trim()
		diarias = diarias
			.split(/\n/g)
			.filter(el => el.trim())
			.reduce((acc, item) => acc += `${item.trim()} `, '')
		ariaLive = ariaLive
			.split(/\n/g)
			.filter(el => el.trim())
			.reduce((acc, item) => acc += `${item.trim()} + `, '')
		ariaLive = ariaLive.substring(0, ariaLive.length - 2)
		periodo1 = periodo1.trim().replace(/(\d*)-(\d*)-(\d*).*/, '$3-$2-$1')
		periodo2 = periodo2.trim().replace(/(\d*)-(\d*)-(\d*).*/, '$3-$2-$1')
		aPartirDe = aPartirDe.trim()
		preco = preco.trim()

		// Scraper
		//bot.telegram.sendMessage('@canaltestebo', diarias)
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
		})
		await page.deleteCookie()
	} catch (error) {
		console.log('scrape error', error);
		ctx.reply('error.message')
	} finally {
		if (browser) {
			await browser.close();
			console.log('closing browser');
			ctx.reply('Dados enviados para o grupo PromoTip Viagens')
		}
	}
}


//scrapeAliExpress('https://pt.aliexpress.com/item/1005003557398937.html', 'https://s.click.aliexpress.com/e/_AWqj5b');

// bot.hears(/enviar (.+)/gi, async ctx => {
// 	(async () => {
// 		try {
// 			let match = ctx.match[1].split(',');
// 			const urlProduto = match[0]
// 			const urlAfiliado = match[1]
// 			scrapeAliExpress(urlProduto, urlAfiliado);
// 		} catch (e) {
// 			ctx.reply(e);
// 		}
// 	})();
// })

bot.launch()
