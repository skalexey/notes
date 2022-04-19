/**
 * Created by skalexey on 09/01/16.
 */

var gl; // A global variable for the WebGL context
var canvas;
var shader_program;
var perspective_matrix;
var mv_matrix;

var vbuf, ibuf;

var interval_between_lines = 0.2;
var y_origin = interval_between_lines * 2;
var current_note = null;
var current_note_symbol = null;
var line_width = 5.0;
var x_position = 0;

function LOG(message)
{
    console.log(message);
}

function LOG_AND_ALERT(message)
{
    LOG(message);
    alert(message);
}

function random(min, max)
{
    if (min != undefined && max != undefined)
    {
        return Math.round(Math.random()*(max-min)+min);
    }
    return Math.round(Math.random() * 10000);
}

var timer = document.getElementById("time");
var begin_time = new Date().getTime();

function update_timer()
{
    var current_time = new Date().getTime();
    var delta_time = (current_time - begin_time) / 1000;
    var minutes = Math.floor(delta_time / 60) % 60;
    var seconds = Math.floor(delta_time % 60);
    var milliseconds = current_time % 1000;
    if(delta_time < 60)
    {
        timer.innerHTML = "%d : %03d".sprintf(seconds, milliseconds);
    }
    else if(delta_time < 3600)
    {
        timer.innerHTML = "%d : %02d : %03d".sprintf(minutes, seconds, milliseconds);
    }
    else
    {
        var hours = Math.floor(delta_time / 3600);
        timer.innerHTML = "%d : %02d : %02d : %03d".sprintf(hours, minutes, seconds, milliseconds);
    }

}

var InputSoundProcessor = function()
{
    this.audioContext = new AudioContext();
    this.microphone_stream = null;
    this.gain_node = null;
    this.analyser_node = null;
    this.input_sound_data_frequencybase = null;
    this.input_sound_data_timebase = null;
    this._is_sound = false;
    this._sound_bottom_limit = 0.001;
    this._frequency_container = document.getElementById("frequency");
    this._number_of_iterations_to_determine_frequency = 5;
    this._calculation_buffer = null;
    this._iteration_number = 0;
    this._current_max_row = null;
    this._difference_container = document.getElementById("difference");
    this._diagram = null;
    this.fft_size = 2048;
    this.init_selector(document.getElementById("devices"));
}

InputSoundProcessor.prototype.init_selector = function(selector)
{
    this._devices_selector = selector;
    var self = this;
    this._devices_selector.addEventListener("change", function()
    {
        var selected_option_index = self._devices_selector.selectedIndex;
        var selected_option = self._devices_selector.options[selected_option_index];
        InputSoundProcessor.instance().sourceSelected(selected_option.source_info.deviceId);
    });

    var option_none = document.createElement("option");
    option_none.text = "None";
    this._devices_selector.add(option_none);
}

InputSoundProcessor.instance = function()
{
    if(InputSoundProcessor._instance == undefined)
    {
        InputSoundProcessor._instance = new InputSoundProcessor();
    }
    return InputSoundProcessor._instance;
}

InputSoundProcessor.prototype.init_user_media = function()
{
    if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia || navigator.msGetUserMedia;
}

InputSoundProcessor.prototype.hasGetUserMedia = function()
{
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia || navigator.msGetUserMedia);
}

InputSoundProcessor.prototype.process_microphone_buffer = function(event)
{
    LOG("process_microphone_buffer");
    var i, N, inp, microphone_output_buffer;
    microphone_output_buffer = event.inputBuffer.getChannelData(0); // just mono - 1 channel for now
}

InputSoundProcessor.prototype.calculate_hertz = function(frequencies, options)
{
  var rate = 22050 / 1024; // defaults in audioContext.

  if (options)
  {
    if (options.rate)
    {
      rate = options.rate;
    }
  }

  var maxI, max = frequencies[0];

  for (var i=0; frequencies.length > i; i++)
  {
    var oldmax = parseFloat(max);
    var newmax = Math.max(max, frequencies[i]);
    if (oldmax != newmax)
    {
      max = newmax;
      maxI = i;
    }
  }
  return maxI * rate;
}

InputSoundProcessor.prototype.show_some_data = function(given_typed_array, num_row_to_display, label)
{
    var size_buffer = given_typed_array.length;
    var index = 0;

    if (label === "time")
    {
        var total_value = 0;
        for (; index < num_row_to_display && index < size_buffer; index += 1)
        {

            var curr_value_time = (given_typed_array[index] / 128) - 1.0;
            total_value += curr_value_time;
        }

        LOG("time: " + total_value / num_row_to_display);

    }
    else if (label === "frequency")
    {

        var total_value = 0;
        var valuable_rows_count = 0;
        var max_value = 0;
        for (; index < num_row_to_display && index < size_buffer; index += 1)
        {
            var row_value = given_typed_array[index];
            if(row_value > max_value)
            {
                max_value = row_value;
            }
            if(row_value > 0)
            {
                valuable_rows_count++;
                total_value += row_value;
            }
        }

        var frequency = calculate_hertz(given_typed_array);
        var frequency_node = document.getElementById("frequency");
        frequency_node.innerHTML = frequency;
        LOG("frequency: " + frequency);

    }
    else
    {
        throw new Error("ERROR - must pass time or frequency");
    }
}

InputSoundProcessor.prototype.update = function()
{
    if(this.analyser_node)
    {
        if(!this.input_sound_data_timebase)
        {
            //self.input_sound_data_frequencybase = new Uint8Array(buffer_length);
            this.input_sound_data_timebase = new Float32Array(this.analyser_node.frequencyBinCount);
        }
        this.analyser_node.getFloatTimeDomainData(this.input_sound_data_timebase);
    }
}

InputSoundProcessor.prototype.sourceSelected = function(audioSource)
{
    var constraints = {
        audio: {
            optional: [{sourceId: audioSource}]
        }
    };

    var self = this;
    navigator.getUserMedia(constraints, function(stream)
    {
        LOG("Sample rate: " + self.audioContext.sampleRate);
        self.gain_node = self.audioContext.createGain();
        LOG("current gain value: " + self.gain_node.gain.value);
        self.gain_node.gain.value = 0;
        self.microphone_stream = self.audioContext.createMediaStreamSource(stream);
        self.analyser_node = self.audioContext.createAnalyser();
        self.analyser_node.smoothingTimeConstant = 0;
        self.analyser_node.fftSize = self.fft_size;

        self.microphone_stream.connect(self.analyser_node);
        self.analyser_node.connect(self.gain_node);
        self.gain_node.connect(self.audioContext.destination);

        var buffer_length = self.analyser_node.frequencyBinCount;

        LOG("buffer_length " + buffer_length);

    }, function(error)
    {
        LOG("Some error occured during get user media");
    });
}

InputSoundProcessor.prototype.register_device = function(audio_source_info)
{
    LOG("Register device: " + JSON.stringify(audio_source_info));
    var option = document.createElement("option");
    option.text = audio_source_info.label.length > 0 ? audio_source_info.label : audio_source_info.deviceId;
    option.source_info = audio_source_info;
    this._devices_selector.add(option);
}

InputSoundProcessor.prototype.init_audio = function()
{
    if (this.hasGetUserMedia())
    {
        // Good to go!
    }
    else
    {
        alert('getUserMedia() is not supported in your browser');
    }

    var self = this;

    navigator.mediaDevices.enumerateDevices().then(function(devices)
    {
        LOG("then ...");
        devices.forEach(function(device)
        {
            if (device.kind === 'audioinput')
            {
                self.register_device(device);
            }
            else
            {
                LOG('Some other kind of source: ' + JSON.stringify(device));
            }
        });
    })
    .catch(function(err)
    {
        LOG(err.name + ": " + err.message);
    });
    LOG("enumerated");
}

var TimeSoundDiagram = function(input_time_sound_data, diagram_length, diagram_height, diagram_origin, color)
{
    this._input_sound_data = input_time_sound_data;
    this._diagram_length = diagram_length;
    this._diagram_height = diagram_height;
    this._diagram_origin = diagram_origin;
    this._line_vertices = new Float32Array();
    this._line_indices = new Uint16Array();
    this._colors = new Float32Array();
    this._color = color;
    this._difference_container = document.getElementById("difference");
}

TimeSoundDiagram.prototype.update = function()
{
    if(this._line_indices.length != this._input_sound_data.length)
    {
        this._line_vertices = new Float32Array(this._input_sound_data.length * 3);
        this._line_indices = new Uint16Array(this._input_sound_data.length);

        var diagram_step_length = this._diagram_length / this._input_sound_data.length;

        for(var vertex_index = 0; vertex_index < this._input_sound_data.length; vertex_index ++)
        {
            var vertex = [vertex_index * diagram_step_length + this._diagram_origin[0], this._diagram_origin[1] + this._diagram_height / 2, this._diagram_origin[2]];
            for(var vertex_part_index in vertex)
            {
                this._line_vertices[vertex_index * 3 + parseInt(vertex_part_index)] = vertex[vertex_part_index];
            }

            this._line_indices[vertex_index] = vertex_index;
        }

        this._colors = new Float32Array(this._line_vertices.length / 3 * 4);
        var index = 0;
        for(var i = 0; i < this._line_vertices.length / 3; i++)
        {
            for(var color_part_index = 0; color_part_index < this._color.length; color_part_index++)
            {
                this._colors[index] = this._color[color_part_index];
                index++;
            }
        }
    }
    var half_diagram_height = this._diagram_height / 2;
    for(var row_index = 0; row_index < this._input_sound_data.length; row_index++)
    {
        var sound_value = this._input_sound_data[row_index];
        this._line_vertices[row_index * 3 + 1] = half_diagram_height * sound_value + this._diagram_origin[1] + half_diagram_height;
    }
}

TimeSoundDiagram.prototype.draw = function()
{
    var vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._line_vertices, gl.STATIC_DRAW);

    var index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._line_indices, gl.STATIC_DRAW);

    gl.vertexAttribPointer(shader_program.aposAttrib, 3, gl.FLOAT, false, 0, 0);

    var color_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._colors, gl.STATIC_DRAW);

    gl.vertexAttribPointer(shader_program.acolAttrib, 4, gl.FLOAT, false, 0, 0);

    gl.lineWidth(0.5);
    //gl.uniform4f(shader_program.colorUniform, 0, 0, 0, 1);
    gl.drawElements(gl.LINES, this._line_indices.length, gl.UNSIGNED_SHORT, 0);


    var comparision_offset_in_diagram = this._diagram_length * this._offset / this._input_sound_data.length;
    draw_line([comparision_offset_in_diagram, this._diagram_origin[1], this._diagram_origin[2], comparision_offset_in_diagram, this._diagram_origin[1] + this._diagram_height, this._diagram_origin[2]]);

    unbind_buffers();
}

var Diagram = function(columns_count, column_width)
{
    this._columns_count = columns_count;
    this._column_width = column_width;
    this._vertices = null;
    this._colors = null;
    this._indices = null;
    this._marked_row = null;
    this._mark_color = [0, 0, 0, 1];
    this.init();
}

Diagram.prototype.mark_row = function(row_index, row_color)
{
    this._marked_row = row_index;
    this._mark_color = row_color;
}
Diagram.prototype.create_simple_column = function(column_origin, color)
{
    var vertices_count = this._vertices.length / 3;

    this._vertices = this._vertices.concat(column_origin);
    this._vertices = this._vertices.concat(column_origin);
    this._vertices = this._vertices.concat([column_origin[0] + this._column_width, column_origin[1], column_origin[2]]);
    this._vertices = this._vertices.concat([column_origin[0] + this._column_width, column_origin[1], column_origin[2]]);

    this._indices.push(vertices_count);
    this._indices.push(vertices_count + 1);
    this._indices.push(vertices_count + 2);
    this._indices.push(vertices_count);
    this._indices.push(vertices_count + 3);
    this._indices.push(vertices_count + 2);

    this._colors = this._colors.concat(color);
    this._colors = this._colors.concat(color);
    this._colors = this._colors.concat(color);
    this._colors = this._colors.concat(color);
}

Diagram.prototype.create_column = function(column_origin, color)
{
    var vertices = [];
    var height = 1;
    vertices = vertices.concat(column_origin);
    vertices = vertices.concat([column_origin[0], column_origin[1] + height, column_origin[2]]);
    vertices = vertices.concat([column_origin[0] + this._column_width, column_origin[1] + height, column_origin[2]]);
    vertices = vertices.concat([column_origin[0] + this._column_width, column_origin[1], column_origin[2]]);

    var indices = [0, 1, 2, 3, 0];

    var colors = new Array();

    for(var i = 0; i < vertices.length / 3; i++)
    {
        colors = colors.concat(color);
    }

    this._indices = this._indices.concat(indices);
    this._vertices = this._vertices.concat(vertices);
    this._colors = this._colors.concat(colors);
}

Diagram.prototype.init = function()
{
    this._vertices = new Array();
    this._colors = new Array();
    this._indices = new Array();

    var color = [0, 0, 1, 1];

    for(var row_index = 0; row_index < this._columns_count; row_index++)
    {
        this.create_simple_column([row_index * this._column_width, 0, 0], color);
    }
}

Diagram.prototype.fill = function(data)
{
    for(var data_row_index = 0; data_row_index < data.length; data_row_index++)
    {
        var data_value = data[data_row_index] / 255;
        this._vertices[data_row_index * 12 + 4] = data_value * 2;
        this._vertices[data_row_index * 12 + 7] = data_value * 2;
    }
}

Diagram.prototype.draw = function()
{
    var vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._vertices), gl.STATIC_DRAW);

    var index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this._indices), gl.STATIC_DRAW);

    gl.vertexAttribPointer(shader_program.aposAttrib, 3, gl.FLOAT, false, 0, 0);

    var color_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._colors), gl.STATIC_DRAW);

    gl.vertexAttribPointer(shader_program.acolAttrib, 4, gl.FLOAT, false, 0, 0);

    //gl.uniform4f(shader_program.colorUniform, 0, 0, 0, 1);
    gl.drawElements(gl.TRIANGLES, this._indices.length, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

Diagram.prototype.draw_column = function(column_value, column_index, column_color)
{
    //column_value = 1;
    var column_x_position = column_index * this._column_width;
    var vertices = new Array();

    vertices = vertices.concat([column_x_position, 0, 0]);
    vertices = vertices.concat([column_x_position, column_value, 0]);
    vertices = vertices.concat([column_x_position + this._column_width, column_value, 0]);
    vertices = vertices.concat([column_x_position + this._column_width, 0, 0]);

    var indices = [0, 1, 2, 0, 3, 2];

    var colors = new Array();
    colors = colors.concat(column_color);
    colors = colors.concat(column_color);
    colors = colors.concat(column_color);
    colors = colors.concat(column_color);


    var vertex_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    var index_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    gl.vertexAttribPointer(shader_program.aposAttrib, 3, gl.FLOAT, false, 0, 0);

    var color_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    gl.vertexAttribPointer(shader_program.acolAttrib, 4, gl.FLOAT, false, 0, 0);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

InputSoundProcessor.prototype.find_peaks = function(fft_data, min_frequency_index, useful_interval_length, peaks_count)
{
    var peaks_values = new Array(peaks_count);
    var peaks_indices = new Array(peaks_count);

    for(var i = 0; i < peaks_count; i++)
    {
        var peak_index = i + min_frequency_index;
        peaks_indices[i] = peak_index;
        peaks_values[i] = fft_data[peak_index];
    }

    var min_stored_peak = peaks_values[0];
    var min_index = 0;
    for(var i = 1; i < peaks_count; i++)
    {
        if(peaks_values[i] < min_stored_peak)
        {
            var min_index = i;
            min_stored_peak = peaks_values[min_index];
        }
    }

    for(var i = peaks_count; i < useful_interval_length; i++)
    {
        if(fft_data[i + min_frequency_index] > min_stored_peak)
        {
            var peak_index = i + min_frequency_index;
            peaks_indices[min_index] = peak_index;
            peaks_values[min_index] = fft_data[peak_index];

            min_index = 0;
            min_stored_peak = peaks_values[min_index];
            for(var j = 1; j < peaks_count; j++)
            {
                if(peaks_values[j] < min_stored_peak)
                {
                    min_index = j;
                    min_stored_peak = peaks_values[min_index];
                }
            }
        }
    }

    return peaks_indices;
}

InputSoundProcessor.prototype.scan_signal_intervals = function(timebase_data, index, length, interval_min, interval_max, out_optimal_interval, out_optimal_value)
{
    var result = {optimal_value: Number.POSITIVE_INFINITY, optimal_interval: 0};

    var max_amount_of_steps = 30;
    var steps = interval_max - interval_min;
    if(steps > max_amount_of_steps)
    {
        steps = max_amount_of_steps;
    }
    else if(steps <= 0)
    {
        steps = 1;
    }

    for(var i = 0; i < steps; i++)
    {
        var interval = Math.floor(interval_min + (interval_max - interval_min) * i / steps);

        var sum = 0;
        for(var j = 0; j < length; j++)
        {
            var diff = (timebase_data[index + j] - timebase_data[index + j + interval]) / 128;
            sum += diff * diff;
        }
        if(result.optimal_value > sum)
        {
            result.optimal_value = sum;
            result.optimal_interval = interval;
        }
    }

    return result;
}

InputSoundProcessor.prototype.find_fundamental_frequency = function(fft_data, timebase_data, sample_rate, minimal_frequency, maximal_frequency)
{
    var min_frequency_index = Math.max(0, Math.floor(minimal_frequency * fft_data.length / sample_rate));
    var max_frequency_index = Math.min(fft_data.length, Math.floor(maximal_frequency * fft_data.length / sample_rate)) + 1;
    var useful_interval_length = max_frequency_index - min_frequency_index;
    var peak_indices = this.find_peaks(fft_data, min_frequency_index, useful_interval_length, 5);

    var peaks = new Array();
    for(var peak_index_index in peak_indices)
    {
        var peak_index = peak_indices[peak_index_index];
        var peak_value = fft_data[peak_index];
        peaks.push(peak_value);
    }
    LOG("Peak indices: " + JSON.stringify(peak_indices));
    LOG("Peaks: " + JSON.stringify(peaks));
    if(peak_indices.indexOf(min_frequency_index) >= 0)
    {
        return 0;
    }

    var verify_fragment_offset = 0;
    var verify_fragment_length = Math.floor(sample_rate / minimal_frequency);

    var min_peak_value = Number.POSITIVE_INFINITY;
    var min_peak_index = 0;
    var min_optimal_interval = 0;
    for(var i = 0; i < peak_indices.length; i++)
    {
        var index = peak_indices[i];
        var bin_interval_start = Math.floor(fft_data.length / (index + 1));
        var bin_interval_end = Math.floor(fft_data.length / index);

        var scan_result = this.scan_signal_intervals(timebase_data, verify_fragment_offset, verify_fragment_length, bin_interval_start, bin_interval_end);

        if(scan_result.optimal_value < min_peak_value)
        {
            min_peak_value = scan_result.optimal_value;
            min_peak_index = index;
            min_optimal_interval = scan_result.optimal_interval;
        }
    }

    return sample_rate / min_optimal_interval;
}

InputSoundProcessor.prototype.show_playing_frequency = function()
{
    if(this.input_sound_data_frequencybase == null)
    {
        return;
    }

    if(!this._calculation_buffer)
    {
        this._calculation_buffer = new Array();
    }

    var fundamental_frequency = this.find_fundamental_frequency(this.input_sound_data_frequencybase, this.input_sound_data_timebase, this.audioContext.sampleRate, 60, 1300);

    LOG("fundamental frequency: " + fundamental_frequency);
    this._frequency_container.innerHTML = fundamental_frequency;

    return;

    var total_sound = 0;

    for(var row_index in this.input_sound_data_frequencybase)
    {
        var row_value = this.input_sound_data_frequencybase[row_index];
        total_sound += row_value;
    }
    if(total_sound >= this.input_sound_data_frequencybase.length * 255 * this._sound_bottom_limit)
    {
        var sound_appeared = false;
        if(!this._is_sound)
        {
            LOG("Sound appeared");
            this._is_sound = true;
            sound_appeared = true;
        }
        if(sound_appeared || this._iteration_number == 0)
        {
            LOG("reset");
        }
        for(var row_index in this.input_sound_data_frequencybase)
        {
            var row_value = this.input_sound_data_frequencybase[row_index];
            if(sound_appeared || this._iteration_number == 0)
            {
                this._calculation_buffer[row_index] = row_value;
            }
            else
            {
                this._calculation_buffer[row_index] = this._calculation_buffer[row_index] + row_value;
            }
        }

        if(this._iteration_number == this._number_of_iterations_to_determine_frequency)
        {
            LOG("iteration " + this._number_of_iterations_to_determine_frequency);
            this._frequency_container.innerHTML = this.get_playing_frequency();
            this._iteration_number = 0;
        }
        else
        {
            this._iteration_number++;
        }
    }
    else
    {
        if(this._is_sound)
        {
            LOG("Sound disappeared");
            this._is_sound = false;
        }
    }
}

InputSoundProcessor.prototype.get_playing_frequency = function()
{
    var max_row_data = {index: 0, value: 0};
    for(var row_index in this._calculation_buffer)
    {
        var row_value = this._calculation_buffer[row_index];
        if(row_value > max_row_data.value)
        {
            max_row_data.value = row_value;
            max_row_data.index = row_index;
        }
    }
    this._current_max_row = max_row_data.index;
    return 22050 / this.input_sound_data_frequencybase.length * max_row_data.index;
}

InputSoundProcessor.prototype.draw_input_sound_time_diagram = function()
{
    if (this.input_sound_data_timebase == null)
    {
        LOG("input_sound_data_timebase is null");
        return;
    }

    var diagram_length = 3;
    var diagram_height = 4;

    if (!this._diagram)
    {
        this._diagram = new TimeSoundDiagram(this.input_sound_data_timebase, diagram_length, diagram_height, [0, 0, 0], [0, 0, 0, 1.0]);
    }

    if(!this._analyser)
    {
        this._analyser = SoundAnalyser.instance(this.input_sound_data_timebase);
        this._analyser.set_input_sound_data_array(this.input_sound_data_timebase);
    }

    this._diagram.update();
    var analyse_result = this._analyser.analyse();
    if(analyse_result.is_note_compared)
    {
        show_random_note();
    }
    this._difference_container.innerHTML = analyse_result.message + " " + analyse_result.relative_difference;
    this._diagram.draw();
}

InputSoundProcessor.prototype.draw_input_fft = function()
{
    if(this.input_sound_data_frequencybase == null)
    {
        LOG("input_sound_data_frequencybase is null");
        return;
    }
    var rectangle_width = 5 / this.input_sound_data_frequencybase.length;
    var max_rectangle_height = 2;

    if(!this._diagram)
    {
        this._diagram = new Diagram(this.input_sound_data_frequencybase.length, 5 / this.input_sound_data_frequencybase.length);
    }

    this._diagram.fill(this.input_sound_data_frequencybase);
    if(this._current_max_row != null)
    {
        this._diagram.mark_row(this._current_max_row, [1, 0, 0, 1]);
    }
    this._diagram.draw();
    if(this._current_max_row != null)
    {
        if(this.input_sound_data_frequencybase)
        {
            this._diagram.draw_column(this.input_sound_data_frequencybase[this._current_max_row] / 255 * 2, this._current_max_row, [1, 0, 0, 1]);
        }
    }
}

function start()
{
    var input_sound_processor = InputSoundProcessor.instance();
    input_sound_processor.init_user_media();
    input_sound_processor.init_audio();
    canvas = document.getElementById("glcanvas");

    // Initialize the GL context
    gl = create_3d_context(canvas);

    // Only continue if WebGL is available and working

    if (gl)
    {
        init();
        var interval = setInterval(function()
        {
            InputSoundProcessor.instance().update();
            update_timer();
            draw_scene();
        }, 30);

    }
    else
    {
        LOG_AND_ALERT("Unable to initialize WebGL. Your browser may not support it.");
    }

    init_keyboard_events();
}

var note_to_key_table =
{
    "e": 69,
    "f": 70,
    "a": 65,
    "d": 68,
    "c": 67,
    "g": 71,
    "b": 66
}

var key_to_note_table = {};
for(var note in note_to_key_table)
{
    var key_code = note_to_key_table[note];
    key_to_note_table[key_code] = note;
}

function init_keyboard_events()
{
    document.onkeydown = function(key_event)
    {
        var key_code = key_event.keyCode;
        if(key_code in key_to_note_table)
        {
            var pressed_note = key_to_note_table[key_code];
            if(current_note_symbol == pressed_note)
            {
                // You are lucky
                show_random_note();
            }
            else
            {
                show_error(pressed_note);
            }
        }
    };
}

function show_error(pressed_note)
{
    LOG("Error! You pressed '" + pressed_note + "', but you should press '" + current_note_symbol + "'");
    //var interval = setInterval(function()
    //{
    //    var current_
    //    change_note_color();
    //}, 200);
}

var create_3d_context = function (canvas, opt_attribs)
{
    var names = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];
    var context = null;
    for (var context_index = 0; context_index < names.length; ++context_index)
    {
        try
        {
            context = opt_attribs ? canvas.getContext(names[context_index], opt_attribs) : canvas.getContext(names[context_index]);
        }
        catch (e)
        {
        }
        if (context)
        {
            break;
        }
    }
    return context;
};

var init = function()
{
    gl.viewport(0, 0, canvas.width, canvas.height);
    // Set clear color to black, fully opaque
    gl.clearColor(1.0, 1.0, 0.0, 1.0);
    // Enable depth testing
    gl.enable(gl.DEPTH_TEST);
    // Near things obscure far things
    gl.depthFunc(gl.LEQUAL);
    // Clear the color as well as the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    init_shaders();

    init_scene();
}

function init_shaders()
{
    var fragment_shader = get_shader("shader-fs");
    var vertex_shader = get_shader("shader-vs");

    // Create the shader program

    shader_program = gl.createProgram();
    gl.attachShader(shader_program, vertex_shader);
    gl.attachShader(shader_program, fragment_shader);
    gl.linkProgram(shader_program);
    gl.useProgram(shader_program);
    shader_program.aposAttrib = gl.getAttribLocation(shader_program, "a_position");
    shader_program.acolAttrib = gl.getAttribLocation(shader_program, "a_vertex_color")
    gl.enableVertexAttribArray(shader_program.aposAttrib);
    gl.enableVertexAttribArray(shader_program.acolAttrib);
    shader_program.colorUniform = gl.getUniformLocation(shader_program, "u_color");
    shader_program.pMUniform = gl.getUniformLocation(shader_program, "up_matrix");
    shader_program.mvMUniform = gl.getUniformLocation(shader_program, "umv_matrix");
}

function get_shader(shader_script_id)
{
    var shader_script, the_source, current_child, shader;

    shader_script = document.getElementById(shader_script_id);

    if (!shader_script)
    {
        return null;
    }

    the_source = "";
    current_child = shader_script.firstChild;

    while(current_child)
    {
        if (current_child.nodeType == current_child.TEXT_NODE)
        {
            the_source += current_child.textContent;
        }

        current_child = current_child.nextSibling;
    }

    if (shader_script.type == "x-shader/x-fragment")
    {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    }
    else if (shader_script.type == "x-shader/x-vertex")
    {
        shader = gl.createShader(gl.VERTEX_SHADER);
    }
    else
    {
        // Unknown shader type
        return null;
    }

    gl.shaderSource(shader, the_source);

    // Compile the shader program
    gl.compileShader(shader);

    // See if it compiled successfully
    var compile_status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    var message = "An error occurred compiling the shaders: ";
    if (!compile_status)
    {
        LOG_AND_ALERT(message + gl.getShaderInfoLog(shader));
        return null;
    }
    else
    {
        LOG("Shader compile status: " + compile_status);
    }

    return shader;
}

function init_scene()
{
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    mv_matrix =
            [1, 0, 0, 0
                , 0, 1, 0.00009999999747378752, 0,
            0, -0.00009999999747378752, 1, 0,
            0, 1.3552527156068805e-20, -8, 1];

    perspective_matrix =
            [2.4142136573791504, 0, 0, 0,
            0, 2.4142136573791504, 0, 0,
            0, 0, -1.0020020008087158, -1,
            0, 0, -0.20020020008087158, 0];

    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(shader_program.pMUniform, false, new Float32Array(perspective_matrix));
    gl.uniformMatrix4fv(shader_program.mvMUniform, false, new Float32Array(mv_matrix));
}

function get_frequency_for_note(note_number)
{
    var note_number_to_frequency =
    {
        "-11": 82.41,
        "-10": 87.31,
        "-9": 98.00,
        "-8": 110.0,
        "-7": 123.5,
        "-6": 130.8,
        "-5": 146.8,
        "-4": 164.8,
        "-3": 174.6,
        "-2": 196.0,
        "-1": 220.0,
        "0": 246.9,
        "1": 261.6,
        "2": 293.7,
        "3": 329.6,
        "4": 349.2,
        "5": 392.0,
        "6": 440.0,
        "7": 493.9,
        "8": 523.3,
        "9": 587.3,
        "10": 659.3,
        "11": 698.5,
        "12": 784.0,
        "13": 880.0,
        "14": 987.8,
        "15": 1047
    }
    return note_number_to_frequency[note_number];
}

function get_offset_for_note(note_number)
{
    var frequency = get_frequency_for_note(note_number);
    var offset = Math.round(InputSoundProcessor.instance().audioContext.sampleRate / frequency);
    return offset;
}

function show_random_note()
{
    var note_number = random(-11, 15);
    current_note = note_number;
    var note_frequency = get_frequency_for_note(note_number);
    SoundAnalyser.instance().set_note_to_compare(note_frequency);
    current_note_symbol = note_number_to_symbol(note_number);
    if(current_note_symbol == undefined)
    {
        LOG("catched");
    }
    x_position = random(100, (line_width - 2) * 100) / 100;
}

var notes_in_order_from_b = ["b", "c", "d", "e", "f", "g", "a"];

function note_number_to_symbol(note_number)
{
    var normalized_note_number = Math.abs(note_number) % 7;
    if(normalized_note_number == 0)
    {
        normalized_note_number = 7;
    }
    var note_id = note_number < 0 ? 7 - normalized_note_number : normalized_note_number == 7 ? 0 : normalized_note_number;
    var result = notes_in_order_from_b[note_id];
    return result;
}

function draw_current_note()
{
    draw_circle([x_position, y_origin + current_note * interval_between_lines / 2, 0], 0.07, 20);
}

function draw_road_to_note()
{
    if(current_note > 5 || current_note < -5)
    {
        for(var ovetnote_index = current_note > 0 ? 6 : -6; Math.abs(ovetnote_index) <= Math.abs(current_note); ovetnote_index = ovetnote_index + (current_note > 0 ? 2 : -2))
        {
            var y_position = y_origin + interval_between_lines / 2 * ovetnote_index;
            draw_line([x_position - 0.5, y_position, 0, x_position + 0.5, y_position, 0]);
        }
    }
}

function draw_scene()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    for(var line_index = 0; line_index < 5; line_index++)
    {
        draw_line([0, interval_between_lines * line_index, 0, line_width, interval_between_lines * line_index, 0]);
    }

    draw_road_to_note();

    if(!current_note)
    {
        show_random_note();
    }
    else
    {
        draw_current_note();
    }

    //InputSoundProcessor.instance().draw_input_fft();
    InputSoundProcessor.instance().draw_input_sound_time_diagram();
    InputSoundProcessor.instance().show_playing_frequency();
}

function unbind_buffers()
{
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

function draw_line(line_vertices)
{
    var vtx = new Float32Array(line_vertices);
    var idx = new Uint16Array([0, 1]);

    vbuf = build_buffer(gl.ARRAY_BUFFER, vtx, 3);
    //gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);

    ibuf = build_buffer(gl.ELEMENT_ARRAY_BUFFER, idx, 1);
    //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf);

    gl.vertexAttribPointer(shader_program.aposAttrib, 3, gl.FLOAT, false, 0, 0);

    var colors = new Array();
    for(var i = 0; i < line_vertices.length / 3; i++)
    {
        colors = colors.concat([0.0, 0.0, 0.0, 1.0]);
    }
    var color_buffer = build_buffer(gl.ARRAY_BUFFER, colors, 4);
    //gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);
    gl.vertexAttribPointer(shader_program.acolAttrib, 4, gl.FLOAT, false, 0, 0);

    gl.lineWidth(1.0);
    //gl.uniform4f(shader_program.colorUniform, 0, 0, 0, 1);
    gl.drawElements(gl.LINES, 2, gl.UNSIGNED_SHORT, 0);

    unbind_buffers();
}

var build_buffer = function(type, data, itemSize)
{
    var buffer = gl.createBuffer();
    var arrayView = type === gl.ARRAY_BUFFER ? Float32Array : Uint16Array;
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, new arrayView(data), gl.STATIC_DRAW);
    buffer.itemSize = itemSize;
    buffer.numItems = data.length / itemSize;
    return buffer;
}

function draw_circle(origin, radius, detalization)
{
    var vertices = [];
    vertices = vertices.concat(origin);
    var indices = [];

    var delta_angle = 360 / detalization;

    for(var circle_part_index = 0; circle_part_index < detalization; circle_part_index++)
    {
        var angle = delta_angle * circle_part_index;

        var dx = radius * Math.cos(angle * Math.PI / 180);
        var dy = radius * Math.sin(angle * Math.PI / 180);

        var point = [origin[0] + dx, origin[1] + dy, origin[2]];
        vertices = vertices.concat(point);
        indices.push(0);
        indices.push(circle_part_index + 1);
        if(circle_part_index == detalization - 1)
        {
            indices.push(1);
        }
        else
        {
            indices.push(circle_part_index + 2);
        }
    }

    var colors = new Array();

    for(var i = 0; i < vertices.length / 3; i++)
    {
        colors = colors.concat([0.0, 0.0, 0.0, 1.0]);
    }

    var vertex_buffer = build_buffer(gl.ARRAY_BUFFER, vertices, 3);
    //gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.vertexAttribPointer(shader_program.aposAttrib, 3, gl.FLOAT, false, 0, 0);

    var index_buffer = build_buffer(gl.ELEMENT_ARRAY_BUFFER, indices, 1);
    //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);

    var color_buffer = build_buffer(gl.ARRAY_BUFFER, colors, 4);
    //gl.bindBuffer(gl.ARRAY_BUFFER, color_buffer);

    gl.vertexAttribPointer(shader_program.acolAttrib, 4, gl.FLOAT, false, 0, 0);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    
    unbind_buffers();
}

function draw_filled_rectangle(origin, width, height, color)
{
    var vertices = [];
    vertices = vertices.concat(origin);
    vertices = vertices.concat([origin[0], origin[1] + height, origin[2]]);
    vertices = vertices.concat([origin[0] + width, origin[1] + height, origin[2]]);
    vertices = vertices.concat([origin[0] + width, origin[1], origin[2]]);

    var indices = [0, 1, 2, 0, 2, 3];

    var colors = new Array();

    for(var i = 0; i < vertices.length / 3; i++)
    {
        colors = colors.concat(color);
    }

    var vertex_buffer = build_buffer(gl.ARRAY_BUFFER, vertices, 3);
    //gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    gl.vertexAttribPointer(shader_program.aposAttrib, 3, gl.FLOAT, false, 0, 0);

    var index_buffer = build_buffer(gl.ELEMENT_ARRAY_BUFFER, indices, 1);
    //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);

    var color_buffer = build_buffer(gl.ARRAY_BUFFER, colors, 4);
    //gl.bundBuffer(gl.ARRAY_BUFFER, color_buffer);
    gl.vertexAttribPointer(shader_program.acolAttrib, 4, gl.FLOAT, false, 0, 0);


    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    unbind_buffers();
}