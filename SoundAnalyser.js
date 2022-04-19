/**
 * Created by biggun on 2/28/2016.
 */

var SoundAnalyserResult = function(is_note_compared, relative_difference, message)
{
    this.is_note_compared = is_note_compared == undefined ? false : is_note_compared;
    this.relative_difference = relative_difference == undefined ? null : relative_difference;
    this.message = message == undefined ? "" : message;
}

var SoundAnalyser = function()
{
    this._input_sound_data = null;
    this._offset = null;
    this._minimum_rms = 0.1;
    this._tolerance = 0.2;
    this._sample_rate = InputSoundProcessor.instance().audioContext.sampleRate;
}

SoundAnalyser.prototype.set_input_sound_data_array = function(input_sound_data_array)
{
    this._input_sound_data = input_sound_data_array;
}

SoundAnalyser.instance = function()
{
    if(SoundAnalyser._instance == undefined)
    {
        SoundAnalyser._instance = new SoundAnalyser();
    }
    return SoundAnalyser._instance;
}

SoundAnalyser.prototype.set_note_to_compare = function(note_frequency)
{
    this._offset = Math.round(this._sample_rate / note_frequency)
}

SoundAnalyser.prototype.analyse = function()
{
    if(this._offset == null)
    {
        return new SoundAnalyserResult();
    }

    if(!this._input_sound_data)
    {
        return new SoundAnalyserResult();
    }

    var offset = this._offset;
    var total_difference = 0;
    var measurements_count = 0;
    var root_mean_square_signal = 0;

    for(var row_index = 0; row_index < this._input_sound_data.length; row_index++)
    {
        var signal_value = this._input_sound_data[row_index];
        root_mean_square_signal += signal_value * signal_value;
    }

    var rms = Math.sqrt(root_mean_square_signal);
    if(rms < this._minimum_rms)
    {
        return new SoundAnalyserResult();
    }

    var half_offset = Math.floor(offset / 2);
    var quarter_offset = Math.floor(offset / 4);
    var total_half_difference = 0, total_quarter_difference = 0;
    var s1 = 0, s2 = 0, half_s1 = 0, half_s2 = 0, quarter_s1 = 0, quarter_s2 = 0;

    for(var row_index = 0; (row_index + offset) < this._input_sound_data.length; row_index++)
    {
        var first_value = this._input_sound_data[row_index];
        s1 += Math.abs(first_value);
        var second_value = this._input_sound_data[row_index + offset];
        s2 += Math.abs(second_value);
        total_difference += Math.abs(first_value - second_value);

        second_value = this._input_sound_data[row_index + half_offset];
        half_s2 += Math.abs(second_value);
        total_half_difference += Math.abs(first_value - second_value);

        second_value = this._input_sound_data[row_index + quarter_offset];
        quarter_s2 += Math.abs(second_value);
        total_quarter_difference += Math.abs(first_value - second_value);
        measurements_count++;
    }

    var average_quarter_s = (s1 + quarter_s2) / 2;
    var relative_quarter_difference = total_quarter_difference / average_quarter_s;
    if (relative_quarter_difference <= this._tolerance)
    {
        return new SoundAnalyserResult(false, relative_quarter_difference, "quarter note");
    }

    var average_half_s = (s1 + half_s2) / 2;
    var relative_half_difference = total_half_difference / average_half_s;
    if (relative_half_difference <= this._tolerance)
    {
        return new SoundAnalyserResult(false, relative_half_difference, "half note");
    }

    var average_s = (s1 + s2) / 2;
    var relative_difference = total_difference / average_s;
    if (relative_difference <= this._tolerance)
    {
        return new SoundAnalyserResult(true, relative_difference, "this guys :)");
    }
    else
    {
        return new SoundAnalyserResult(false, relative_difference, "");
    }
}

SoundAnalyser.prototype.update = function()
{

}