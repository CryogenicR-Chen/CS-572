import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';
const app = express();
app.use(express.json());
app.use('/', express.static('angular-bootstrap/dist/angular-bootstrap/browser'))
const api = ""
const api2 = ""

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`
            Server is running on port $ { port }
            `);
});

const uri = "";
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        await client.db('mydatabase').dropDatabase();
        const collection = client.db('mydatabase').collection('mycollection');
        const data = { money: 25000 };
        const result = await collection.insertOne(data);
    } finally {
        await client.close();
    }
}
run().catch(console.dir);


// 定义路由
app.use(cors());
app.get('/search/home', (req, res) => {
    const key = req.query.key;
    const apiUrl = `https://finnhub.io/api/v1/search?q=${key}&token=${api}`;

    axios.get(apiUrl)
        .then(response => {
            res.json(response.data);
        })
        .catch(error => {
            res.status(500).json({ error: 'Failed to fetch data from Finnhub API' });
        });


});

async function select(key) {
    key = key.toUpperCase();
    let client;
    try {
        client = await MongoClient.connect(uri);
        const collection = client.db('mydatabase').collection('mycollection');
        const stock = await collection.find({ ticker: key }).toArray();
        const money = await collection.find({ money: { $exists: true, $ne: null } }).toArray();
        return { stock: stock, money: money };
    } finally {
        if (client) {
            client.close();
        }
    }
}

async function selectAll() {
    let client;
    try {
        client = await MongoClient.connect(uri);
        const collection = client.db('mydatabase').collection('mycollection');
        const data = await collection.find({ tag: 1 }).toArray();
        return data;
    } finally {
        if (client) {
            client.close();
        }
    }
}

async function change(key, num) {
    let client;
    try {
        client = await MongoClient.connect(uri);
        const collection = client.db('mydatabase').collection('mycollection');
        const data = await collection.findOne({ ticker: key, stock: num, tag: 1 });
        if (data) {
            const result = await collection.updateOne({ ticker: key }, { $set: { ticker: key, stock: num } }, { upsert: true });
            return result.modifiedCount > 0;
        } else {
            return false;
        }
    } finally {
        if (client) {
            client.close();
        }
    }
}

async function changeWatchlist(key, isNotHide) {
    let client;
    try {
        client = await MongoClient.connect(uri);
        const collection = client.db('mydatabase').collection('watchlist');
        console.log(key + isNotHide);
        await collection.updateOne({ ticker: key }, { $set: { ticker: key, isNotHide: isNotHide } }, { upsert: true });
    } finally {
        if (client) {
            client.close();
        }
    }
}
async function changeStock(key, num, price, stockPrice) {
    let client;
    try {
        client = await MongoClient.connect(uri);
        const collection = client.db('mydatabase').collection('mycollection');
        const pre = await collection.find({
            num: { $ne: 0 },
            ticker: key,
            tag: 1
        }).toArray();
        console.log(num);
        console.log(price);

        console.log((pre[0] ? pre[0].stock : 0));
        console.log((num - (pre[0] ? pre[0].stock : 0)) * stockPrice);

        const roundedTotalChange = parseFloat(((num - (pre[0] ? pre[0].stock : 0)) * stockPrice).toFixed(2));
        console.log(roundedTotalChange);
        await collection.updateOne({ ticker: key }, {
            $set: { ticker: key, stock: parseFloat(num), tag: 1 },
            $inc: {
                total: roundedTotalChange
            }
        }, { upsert: true });
        await collection.deleteMany({ stock: '0' });

        await collection.updateOne({ money: { $exists: true, $ne: null } }, { $set: { money: price } }, { upsert: true });
        const data = await collection.find({}).toArray();
        console.log(data)
    } finally {
        if (client) {
            client.close();
        }
    }
}
async function findWatchlist() {
    let client;
    // console.log('ininin');
    try {
        client = await MongoClient.connect(uri);

        const collection = client.db('mydatabase').collection('watchlist');
        const data = await collection.find({ isNotHide: 'TRUE' }).toArray();
        console.log(data);
        return data;
    } finally {
        if (client) {
            client.close();
        }
    }
}

async function findStock() {
    let client;
    // console.log('ininin');
    try {
        client = await MongoClient.connect(uri);

        const collection = client.db('mydatabase').collection('mycollection');
        const data = await collection.find({
            stock: { $ne: 0 },
            tag: 1
        }).toArray();
        const money = await collection.find({ money: { $exists: true, $ne: null } }).toArray();
        return { data: data, money: money };
    } finally {
        if (client) {
            client.close();
        }
    }
}

app.get('/price', async(req, res) => {
    const data = await findWatchlist();
    let ticker = '';
    console.log(data);
    console.log("xxxxxxxxxxxx");
    if (data.length == 0) {
        res.json([]);
        return;
    }
    for (let i = 0; i < data.length; i++) {
        ticker += data[i].ticker.toUpperCase();
        if (i < data.length - 1) {
            ticker += '-';
        }
    }

    console.log(ticker);

    const tickers = ticker.split('-');
    console.log(tickers);
    const pricePromises = [];
    console.log("entter")
    try {
        for (const ticker of tickers) {
            const apiUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${api}`;
            const apiPrice = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${api}`;
            pricePromises.push(
                Promise.all([
                    axios.get(apiUrl),
                    axios.get(apiPrice)
                ])
                .then(([profileResponse, priceResponse]) => ({
                    ticker,
                    companyInfo: profileResponse.data,
                    priceInfo: priceResponse.data
                }))
            );
        }
        Promise.all(pricePromises)
            .then(data => {
                res.json(data);
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                res.status(500).send('Internal Server Error');
            });
    } catch (error) {
        console.error('Failed to fetch data from Finnhub API:', error);
        res.status(500).json({ error: 'Failed to fetch data from Finnhub API' });
    }

});

app.get('/stock1', async(req, res) => {
    const dataAll = await findStock();
    const data = dataAll.data;

    const tickerDataMap = {};
    data.forEach(entry => {
        const ticker = entry.ticker;
        if (!tickerDataMap[ticker]) {
            tickerDataMap[ticker] = [];
        }
        tickerDataMap[ticker].push(entry);
    });
    const dataArray = Object.keys(tickerDataMap).map(ticker => ({
        ticker: ticker,
        data: tickerDataMap[ticker]
    }));




    let ticker = '';
    console.log(data);
    console.log("xxxxxxxxxxxx");

    for (let i = 0; i < data.length; i++) {
        ticker += data[i].ticker.toUpperCase();
        if (i < data.length - 1) {
            ticker += '-';
        }
    }

    console.log(ticker);

    const tickers = ticker.split('-');
    console.log(tickers);
    const pricePromises = [];
    console.log("entter")

    try {
        for (const { ticker }
            of dataArray) {
            const apiUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${api}`;
            const apiPrice = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${api}`;
            pricePromises.push(
                Promise.all([
                    axios.get(apiUrl),
                    axios.get(apiPrice)
                ])
                .then(([profileResponse, priceResponse]) => ({
                    ticker,
                    companyInfo: profileResponse.data,
                    priceInfo: priceResponse.data,
                    data: tickerDataMap[ticker],

                }))
            );
        }
        Promise.all(pricePromises)
            .then(data => {
                res.json({
                    data: data,
                    money: dataAll.money
                });
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                res.status(500).send('Internal Server Error');
            });
    } catch (error) {
        console.error('Failed to fetch data from Finnhub API:', error);
        res.status(500).json({ error: 'Failed to fetch data from Finnhub API' });
    }

});
app.get('/search/update/:ticker', async(req, res) => {
    try {
        const key = req.params.ticker.toUpperCase();
        const apiPrice = `https://finnhub.io/api/v1/quote?symbol=${key}&token=${api}`;
        const [priceResponse] = await Promise.all([
            axios.get(apiPrice),
        ]);
        const responseData = {
            priceInfo: priceResponse.data,
        };
        res.json(responseData);
    } catch (error) {
        console.error('Failed to fetch data from Finnhub API:', error);

    }

})
app.get('/search1/:ticker', async(req, res) => {

    try {
        const key = req.params.ticker.toUpperCase();
        const apiUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${key}&token=${api}`;
        const apiPrice = `https://finnhub.io/api/v1/quote?symbol=${key}&token=${api}`;
        const apiPeers = `https://finnhub.io/api/v1/stock/peers?symbol=${key}&token=${api}`;
        const apiInsider = `https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${key}&from=2022-01-01&token=${api}`

        const currentDate = new Date();

        const year = currentDate.getFullYear();
        const month = ('0' + (currentDate.getMonth() + 1)).slice(-2);
        const day = ('0' + currentDate.getDate()).slice(-2);

        const startdate = new Date();
        startdate.setDate(currentDate.getDate() - 3);
        const year2 = startdate.getFullYear();
        const month2 = ('0' + (startdate.getMonth() + 1)).slice(-2);
        const day2 = ('0' + startdate.getDate()).slice(-2);

        const startdate7 = new Date();
        startdate7.setDate(currentDate.getDate() - 7);
        const year7 = startdate7.getFullYear();
        const month7 = ('0' + (startdate7.getMonth() + 1)).slice(-2);
        const day7 = ('0' + startdate7.getDate()).slice(-2);


        let twoYearsAgoDate = new Date(currentDate.getFullYear() - 2, currentDate.getMonth(), currentDate.getDate());
        const year2year = twoYearsAgoDate.getFullYear();
        const month2year = ('0' + (twoYearsAgoDate.getMonth() + 1)).slice(-2);
        const day2year = ('0' + twoYearsAgoDate.getDate()).slice(-2);


        var apiHistory = ``;
        const apiHistoryYear = `https://api.polygon.io/v2/aggs/ticker/${key}/range/1/day/${year2year}-${month2year}-${day2year}/${year}-${month}-${day}?adjusted=true&sort=asc&apiKey=${api2}`;
        console.log(apiHistoryYear);
        const apiNews = `https://finnhub.io/api/v1/company-news?symbol=${key}&from=${year7}-${month7}-${day7}&to=${year}-${month}-${day}&token=${api}`
        console.log(apiNews);
        console.log("NNNNNNNNNNNNNNN");
        const apiEarning = `https://finnhub.io/api/v1/stock/earnings?symbol=${key}&token=${api}`
        const apiRecommendation = `https://finnhub.io/api/v1/stock/recommendation?symbol=${key}&token=${api}`


        const tempP = (await axios.get(apiPrice)).data;
        console.log("uwuwuwuwu");
        console.log(tempP)
        const tempPTimestamp = tempP.t * 1000;

        const timeDifference = new Date().getTime() - tempPTimestamp;
        const timeDifferenceInMinutes = timeDifference / (1000 * 60);
        console.log(tempP.t * 1000)
        if (timeDifferenceInMinutes > 5) {
            const tempPDate = new Date(tempP.t * 1000);
            tempPDate.setDate(tempPDate.getDate() - 1);

            const yearx = tempPDate.getFullYear();
            const monthx = ('0' + (tempPDate.getMonth() + 1)).slice(-2);
            const dayx = ('0' + tempPDate.getDate()).slice(-2);




            const tempPDate2 = new Date(tempP.t * 1000);
            const yearP = tempPDate2.getFullYear();
            const monthP = ('0' + (tempPDate2.getMonth() + 1)).slice(-2);
            const dayP = ('0' + tempPDate2.getDate()).slice(-2);
            console.log("999")
            apiHistory = `https://api.polygon.io/v2/aggs/ticker/${key}/range/1/hour/${yearx}-${monthx}-${dayx}/${yearP}-${monthP}-${dayP}?adjusted=true&sort=asc&apiKey=${api2}`
        } else {
            const tempPDate = new Date();
            tempPDate.setDate(tempPDate.getDate() - 1);

            const yearx = tempPDate.getFullYear();
            const monthx = ('0' + (tempPDate.getMonth() + 1)).slice(-2);
            const dayx = ('0' + tempPDate.getDate()).slice(-2);

            const tempPDate2 = new Date();

            const yearP = tempPDate2.getFullYear();
            const monthP = ('0' + (tempPDate2.getMonth() + 1)).slice(-2);
            const dayP = ('0' + tempPDate2.getDate()).slice(-2);
            console.log("666")
            apiHistory = `https://api.polygon.io/v2/aggs/ticker/${key}/range/1/hour/${yearx}-${monthx}-${dayx}/${yearP}-${monthP}-${dayP}?adjusted=true&sort=asc&apiKey=${api2}`
        }


        console.log(apiHistory);
        const [profileResponse, priceResponse, peersResponse, historyResponse, newsResponse, historyYearResponse, insiderResponse, earningResponse, recommendationResponse] = await Promise.all([
            axios.get(apiUrl),
            axios.get(apiPrice),
            axios.get(apiPeers),
            axios.get(apiHistory),
            axios.get(apiNews),
            axios.get(apiHistoryYear),
            axios.get(apiInsider),
            axios.get(apiEarning),
            axios.get(apiRecommendation),
        ]);

        const filteredNews = newsResponse.data.filter(item => item.image !== null && item.headline !== null && item.image !== '' && item.headline !== '').slice(0, 20);
        var historyData;
        var historyDataV;
        var historyDataC;
        try {
            historyData = historyResponse.data.results.map(item => [item.t, item.c]);
            historyDataV = historyYearResponse.data.results.map(item => [item.t, item.v]);
            historyDataC = historyYearResponse.data.results.map(item => [item.t, item.o, item.h, item.l, item.c]);

        } catch (error) {
            historyData = [];
            historyDataV = [];
            historyDataC = [apiHistory];
            console.log("no historyData");
        }

        let nm = 0;
        let pm = 0;
        let tc = 0;
        let pc = 0;
        let nc = 0;
        let tm = 0;
        Object.values(insiderResponse.data.data).forEach(item => {
            console.log(item.mspr)
            if (item.mspr < 0) {
                nm += item.mspr;
            } else {
                pm += item.mspr;
            }
            if (item.change < 0) {
                nc += item.change;
            } else {
                pc += item.change;
            }
            tc += item.change;
            tm += item.mspr;

        });

        const insiderR = {
            nm: nm,
            pm: pm,
            tc: tc,
            pc: pc,
            nc: nc,
            tm: tm
        }
        earningResponse.data.sort((a, b) => new Date(a.period) - new Date(b.period))
        earningResponse.data.forEach(earning => {
            for (const key in earning) {
                if (earning.hasOwnProperty(key) && earning[key] === null) {
                    earning[key] = 0;
                }
            }
        });
        earningResponse.data.forEach(earning => {
            earning.period = `<span style="text-align:center">${earning.period}<br>surprise: ${earning.surprise.toFixed(4)}</span>`;
            for (const key in earning) {
                if (earning.hasOwnProperty(key) && earning[key] === null) {
                    earning[key] = 0;
                }
            }
        });
        const tupleArray1 = earningResponse.data.map(earning => earning.actual);
        const tupleArray2 = earningResponse.data.map(earning => earning.estimate);
        const tupleArrayx = earningResponse.data.map(earning => earning.period);
        const reversedTupleArray1 = tupleArray1.reverse();
        const reversedTupleArray2 = tupleArray2.reverse();
        const reversedTupleArrayx = tupleArrayx.reverse();

        earningResponse.data = {
            estimate: reversedTupleArray2,
            actual: reversedTupleArray1,
            x: reversedTupleArrayx
        };


        const r1 = recommendationResponse.data.map(earning => earning.strongBuy);
        const r2 = recommendationResponse.data.map(earning => earning.buy);
        const r3 = recommendationResponse.data.map(earning => earning.hold);
        const r4 = recommendationResponse.data.map(earning => earning.sell);
        const r5 = recommendationResponse.data.map(earning => earning.strongSell);
        const r6 = recommendationResponse.data.map(earning => earning.period.slice(0, -3));
        const watchlist = await findWatchlist();
        const portlist = await findStock();
        recommendationResponse.data = {
            strongBuy: r1,
            buy: r2,
            hold: r3,
            sell: r4,
            strongSell: r5,
            period: r6,
        }
        const responseData = {
            companyInfo: profileResponse.data,
            priceInfo: priceResponse.data,
            peers: peersResponse.data,
            newsInfo: filteredNews,
            historyInfo: historyData,
            historyDataV: historyDataV,
            historyDataC: historyDataC,
            insider: insiderR,
            earning: earningResponse.data,
            recommendation: recommendationResponse.data,
            stock: portlist.data,
            money: portlist.money,
            watchlist: watchlist,
        };

        res.json(responseData);
    } catch (error) {
        res.status(500).json(error);
        console.log(error);
    }

});
app.get('/change/:ticker/:num', async(req, res) => {
    try {
        const key = req.params.ticker.toUpperCase();
        const num = req.params.num
        change(key, num);
    } catch (error) {
        console.log(error);
    }
});
app.get('/changeWatchlist/:ticker/:isNotHide', async(req, res) => {
    console.log("visit");
    const key = req.params.ticker.toUpperCase();
    const isNotHide = req.params.isNotHide.toUpperCase();
    await changeWatchlist(key, isNotHide);
    const data = await findWatchlist()
    res.json(data);
});

app.get('/changeStock/:ticker/:num/:price/:stockPrice', async(req, res) => {
    console.log("stock");
    const key = req.params.ticker.toUpperCase();
    const num = req.params.num;
    const price = req.params.price;
    const stockPrice = req.params.stockPrice;
    console.log(stockPrice)
    await changeStock(key, num, price, stockPrice);
    const data = await findStock()
    res.json(data);
});

app.get('/watchlist1', async(req, res) => {
    watchlist = findWatchlist();
    console.log(watchlist)
    res.json(watchlist);
});

app.get('/portfolio1', async(req, res) => {
    watchlist = findStock();
    console.log(watchlist)
    res.json(watchlist);
});