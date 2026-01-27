export function terbilang(nilai: number): string {
    const angka = Math.abs(nilai);
    const baca = [
        "",
        "Satu",
        "Dua",
        "Tiga",
        "Empat",
        "Lima",
        "Enam",
        "Tujuh",
        "Delapan",
        "Sembilan",
        "Sepuluh",
        "Sebelas",
    ];
    let terbilang = "";

    if (angka < 12) {
        terbilang = " " + baca[Math.floor(angka)];
    } else if (angka < 20) {
        terbilang = terbilangCalc(angka - 10) + " Belas";
    } else if (angka < 100) {
        terbilang =
            terbilangCalc(Math.floor(angka / 10)) +
            " Puluh" +
            terbilangCalc(angka % 10);
    } else if (angka < 200) {
        terbilang = " Seratus" + terbilangCalc(angka - 100);
    } else if (angka < 1000) {
        terbilang =
            terbilangCalc(Math.floor(angka / 100)) +
            " Ratus" +
            terbilangCalc(angka % 100);
    } else if (angka < 2000) {
        terbilang = " Seribu" + terbilangCalc(angka - 1000);
    } else if (angka < 1000000) {
        terbilang =
            terbilangCalc(Math.floor(angka / 1000)) +
            " Ribu" +
            terbilangCalc(angka % 1000);
    } else if (angka < 1000000000) {
        terbilang =
            terbilangCalc(Math.floor(angka / 1000000)) +
            " Juta" +
            terbilangCalc(angka % 1000000);
    } else if (angka < 1000000000000) {
        terbilang =
            terbilangCalc(Math.floor(angka / 1000000000)) +
            " Milyar" +
            terbilangCalc(angka % 1000000000);
    } else if (angka < 1000000000000000) {
        terbilang =
            terbilangCalc(Math.floor(angka / 1000000000000)) +
            " Trilyun" +
            terbilangCalc(angka % 1000000000000);
    }

    return terbilang;
}

function terbilangCalc(nilai: number): string {
    return terbilang(nilai);
}

export function formatTerbilang(amount: number): string {
    const result = terbilang(amount).trim() + " Rupiah";
    return result.replace(/\s+/g, " "); // Remove extra spaces
}
