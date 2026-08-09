const CONFIG_URL = 'data/layers.json';

let config = null;

const state = {};

let currentAudio = null;

const controlsElement = document.getElementById('controls');
const stageElement = document.getElementById('stage');
const statusElement = document.getElementById('status');
const downloadButton = document.getElementById('downloadButton');

document.addEventListener('DOMContentLoaded', init);


async function init() {

    try {

        setStatus('Загрузка конфигурации...');

        const response = await fetch(CONFIG_URL);

        if (!response.ok) {
            throw new Error(
                `Не удалось загрузить ${CONFIG_URL}: HTTP ${response.status}`
            );
        }

        config = await response.json();

        validateConfig();

        initializeState();

        createControls();

        render();

    } catch (error) {

        console.error(error);

        controlsElement.innerHTML = `
            <div class="error">
                <strong>Ошибка загрузки конфигурации</strong>
                <br><br>
                ${escapeHtml(error.message)}
            </div>
        `;

        setStatus('Ошибка');

    }

}


function validateConfig() {

    if (!config) {
        throw new Error('Конфигурация пуста.');
    }

    if (!Array.isArray(config.layerOrder)) {
        throw new Error(
            'В layers.json отсутствует массив "layerOrder".'
        );
    }

    if (!config.categories) {
        throw new Error(
            'В layers.json отсутствует объект "categories".'
        );
    }

    for (const category of config.layerOrder) {

        if (!config.categories[category]) {
            throw new Error(
                `Категория "${category}" указана в layerOrder, ` +
                `но отсутствует в categories.`
            );
        }

        if (!Array.isArray(config.categories[category].options)) {
            throw new Error(
                `У категории "${category}" отсутствует массив options.`
            );
        }

    }

}


function initializeState() {

    /*
     * Инициализируем только графические категории
     * и голос.
     */

    Object.keys(config.categories).forEach(category => {

        const options = config.categories[category].options;

        state[category] = options.length > 0 ? 0 : -1;

    });

}


function createControls() {

    controlsElement.innerHTML = '';

    /*
     * Сначала создаём графические категории
     * в порядке layerOrder.
     */

    config.layerOrder.forEach(category => {

        createCategoryControl(category);

    });


    /*
     * Голос располагаем после всех слоёв.
     */

    if (config.categories.voice) {

        createVoiceControl();

    }

}


function createCategoryControl(category) {

    const categoryData = config.categories[category];

    const control = document.createElement('div');

    control.className = 'control';

    const label = document.createElement('label');

    label.textContent = categoryData.name || category;

    control.appendChild(label);

    const row = document.createElement('div');

    row.className = 'row';


    const previousButton = document.createElement('button');

    previousButton.type = 'button';

    previousButton.textContent = '←';

    previousButton.title = 'Предыдущий вариант';

    previousButton.addEventListener('click', () => {

        changeOption(category, -1);

    });


    const select = document.createElement('select');

    select.dataset.category = category;

    categoryData.options.forEach((option, index) => {

        const optionElement = document.createElement('option');

        optionElement.value = index;

        optionElement.textContent = option.name;

        select.appendChild(optionElement);

    });


    select.addEventListener('change', event => {

        state[category] = Number(event.target.value);

        render();

    });


    const nextButton = document.createElement('button');

    nextButton.type = 'button';

    nextButton.textContent = '→';

    nextButton.title = 'Следующий вариант';

    nextButton.addEventListener('click', () => {

        changeOption(category, 1);

    });


    row.appendChild(previousButton);
    row.appendChild(select);
    row.appendChild(nextButton);

    control.appendChild(row);

    controlsElement.appendChild(control);

}


function createVoiceControl() {

    const category = 'voice';

    const categoryData = config.categories.voice;

    const control = document.createElement('div');

    control.className = 'control voice-control';


    const label = document.createElement('label');

    label.textContent = categoryData.name || 'Голос';

    control.appendChild(label);


    const row = document.createElement('div');

    row.className = 'row';


    const previousButton = document.createElement('button');

    previousButton.type = 'button';

    previousButton.textContent = '←';

    previousButton.title = 'Предыдущий голос';

    previousButton.addEventListener('click', () => {

        stopAudio();

        changeOption(category, -1);

    });


    const select = document.createElement('select');

    select.dataset.category = category;

    categoryData.options.forEach((option, index) => {

        const optionElement = document.createElement('option');

        optionElement.value = index;

        optionElement.textContent = option.name;

        select.appendChild(optionElement);

    });


    select.addEventListener('change', event => {

        stopAudio();

        state[category] = Number(event.target.value);

    });


    const nextButton = document.createElement('button');

    nextButton.type = 'button';

    nextButton.textContent = '→';

    nextButton.title = 'Следующий голос';

    nextButton.addEventListener('click', () => {

        stopAudio();

        changeOption(category, 1);

    });


    row.appendChild(previousButton);
    row.appendChild(select);
    row.appendChild(nextButton);

    control.appendChild(row);


    /*
     * Кнопка прослушивания
     */

    const playButton = document.createElement('button');

    playButton.type = 'button';

    playButton.className = 'voice-play';

    playButton.textContent = '▶ Прослушать';

    playButton.addEventListener('click', () => {

        playSelectedVoice(playButton);

    });


    control.appendChild(playButton);

    controlsElement.appendChild(control);

}


function changeOption(category, direction) {

    const options = config.categories[category].options;

    if (!options.length) {
        return;
    }

    let index = state[category];

    index += direction;

    if (index < 0) {
        index = options.length - 1;
    }

    if (index >= options.length) {
        index = 0;
    }

    state[category] = index;

    updateSelect(category);

    render();

}


function updateSelect(category) {

    const select = controlsElement.querySelector(
        `select[data-category="${CSS.escape(category)}"]`
    );

    if (!select) {
        return;
    }

    select.value = String(state[category]);

}


function render() {

    if (!config) {
        return;
    }

    stageElement.innerHTML = '';


    config.layerOrder.forEach(category => {

        const categoryData = config.categories[category];

        const index = state[category];

        if (
            index === undefined ||
            index < 0 ||
            index >= categoryData.options.length
        ) {
            return;
        }

        const selected = categoryData.options[index];

        if (!selected.image) {
            return;
        }


        const image = document.createElement('img');

        image.src = selected.image;

        image.alt = selected.name || category;

        image.dataset.category = category;

        image.dataset.index = index;


        image.addEventListener('error', () => {

            console.error(
                `Не удалось загрузить изображение: ${selected.image}`
            );

            setStatus(
                `Не удалось загрузить: ${selected.name}`
            );

        });


        stageElement.appendChild(image);

    });


    setStatus(
        `Выбрано: ${getCurrentDescription()}`
    );

}


function getCurrentDescription() {

    const parts = [];

    config.layerOrder.forEach(category => {

        const categoryData = config.categories[category];

        const index = state[category];

        if (
            index !== undefined &&
            index >= 0 &&
            index < categoryData.options.length
        ) {

            parts.push(
                categoryData.options[index].name
            );

        }

    });

    return parts.join(' / ');

}


async function playSelectedVoice(button) {

    if (!config.categories.voice) {
        return;
    }

    const options = config.categories.voice.options;

    const index = state.voice;

    if (
        index === undefined ||
        index < 0 ||
        index >= options.length
    ) {
        return;
    }

    const selected = options[index];

    if (!selected.audio) {

        setStatus('У выбранного голоса нет аудиофайла.');

        return;

    }


    /*
     * Если сейчас что-то играет —
     * останавливаем.
     */

    if (currentAudio) {

        stopAudio();

        /*
         * Если пользователь нажал кнопку во время
         * воспроизведения — запускаем заново.
         */

    }


    currentAudio = new Audio(selected.audio);


    button.textContent = '⏹ Остановить';


    currentAudio.addEventListener('ended', () => {

        button.textContent = '▶ Прослушать';

        currentAudio = null;

    });


    currentAudio.addEventListener('error', () => {

        button.textContent = '▶ Прослушать';

        setStatus(
            `Не удалось воспроизвести: ${selected.name}`
        );

        currentAudio = null;

    });


    try {

        await currentAudio.play();

        setStatus(
            `Воспроизводится: ${selected.name}`
        );

    } catch (error) {

        console.error(error);

        button.textContent = '▶ Прослушать';

        currentAudio = null;

        setStatus(
            'Браузер не разрешил воспроизведение аудио.'
        );

    }

}


function stopAudio() {

    if (!currentAudio) {
        return;
    }

    currentAudio.pause();

    currentAudio.currentTime = 0;

    currentAudio = null;


    const button = document.querySelector(
        '.voice-play'
    );

    if (button) {
        button.textContent = '▶ Прослушать';
    }

}


async function downloadPNG() {

    if (!config) {
        return;
    }

    const images = Array.from(
        stageElement.querySelectorAll('img')
    );

    if (!images.length) {

        setStatus('Нет изображений для сохранения.');

        return;

    }

    setStatus('Подготовка PNG...');


    try {

        await Promise.all(
            images.map(waitForImage)
        );


        const firstImage = images[0];

        const width = firstImage.naturalWidth;
        const height = firstImage.naturalHeight;


        if (!width || !height) {

            throw new Error(
                'Не удалось определить размер изображения.'
            );

        }


        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;


        const ctx = canvas.getContext('2d');


        for (const image of images) {

            ctx.drawImage(
                image,
                0,
                0,
                width,
                height
            );

        }


        const filename =
            'character-' +
            createFilename() +
            '.png';


        canvas.toBlob(blob => {

            if (!blob) {

                setStatus(
                    'Не удалось создать PNG.'
                );

                return;

            }


            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');

            link.href = url;

            link.download = filename;

            document.body.appendChild(link);

            link.click();

            link.remove();

            URL.revokeObjectURL(url);


            setStatus(
                `PNG готов: ${filename}`
            );

        }, 'image/png');

    } catch (error) {

        console.error(error);

        setStatus(
            `Ошибка сохранения: ${error.message}`
        );

    }

}


function waitForImage(image) {

    if (
        image.complete &&
        image.naturalWidth > 0
    ) {

        return Promise.resolve();

    }

    return new Promise((resolve, reject) => {

        image.addEventListener(
            'load',
            resolve,
            { once: true }
        );

        image.addEventListener(
            'error',
            () => reject(
                new Error(
                    `Не удалось загрузить ${image.src}`
                )
            ),
            { once: true }
        );

    });

}


function createFilename() {

    const parts = [];

    config.layerOrder.forEach(category => {

        const categoryData = config.categories[category];

        const index = state[category];

        if (
            index !== undefined &&
            index >= 0 &&
            index < categoryData.options.length
        ) {

            parts.push(
                `${category}-${index + 1}`
            );

        }

    });


    /*
     * Добавляем выбранный голос
     * в имя файла.
     */

    if (
        config.categories.voice &&
        state.voice !== undefined
    ) {

        parts.push(
            `voice-${state.voice + 1}`
        );

    }


    return parts.join('_');

}


function setStatus(message) {

    statusElement.textContent = message;

}


function escapeHtml(value) {

    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

}


window.downloadPNG = downloadPNG;
